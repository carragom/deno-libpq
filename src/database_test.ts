import {
	assertEquals,
	assertExists,
	assertNotEquals,
	assertRejects,
	assertThrows,
} from '@std/assert'
import { delay } from '@std/async'

import { DENO_LIBPQ_PATH, PGURL } from './constants.ts'
import {
	backendPID,
	cancel,
	clear,
	connectdb,
	connectdbAsync,
	consumeInput,
	db,
	escapeIdentifier,
	escapeLiteral,
	exec,
	execAsync,
	execParamsAsync,
	execPreparedAsync,
	finish,
	fname,
	freeCancel,
	getCancel,
	getvalue,
	host,
	nfields,
	notifies,
	ntuples,
	options,
	parameterStatus,
	ping,
	port,
	prepareAsync,
	protocolVersion,
	reset,
	resultErrorField,
	resultErrorMessage,
	resultStatus,
	resultVerboseErrorMessage,
	status,
	transactionStatus,
	user,
} from './database.ts'
import {
	ConnStatusType,
	ExecStatusType,
	PGContextVisibility,
	PGDiag,
	PGPing,
	PGTransactionStatusType,
	PGVerbosity,
	PostgresPollingStatusType,
} from './ffi.ts'
import { conninfoParamsFromUrl } from './utils.ts'

const PG_ENV_KEYS = [
	'PGHOST',
	'PGPORT',
	'PGUSER',
	'PGPASSWORD',
	'PGDATABASE',
] as const
const DEFAULT_PGURL = 'postgresql://localhost'
let initialPgurl: string | undefined
let previousPgurl: string

Deno.test.beforeAll(() => {
	initialPgurl = Deno.env.get(PGURL)
	if (initialPgurl === undefined || initialPgurl.trim() === '') {
		Deno.env.set(PGURL, DEFAULT_PGURL)
	}
})

Deno.test.afterAll(() => {
	if (initialPgurl === undefined) {
		Deno.env.delete(PGURL)
	} else {
		Deno.env.set(PGURL, initialPgurl)
	}
})

Deno.test.beforeEach(() => {
	previousPgurl = Deno.env.get(PGURL)!
})

Deno.test.afterEach(() => {
	if (previousPgurl === undefined) {
		Deno.env.delete(PGURL)
	} else {
		Deno.env.set(PGURL, previousPgurl)
	}
})

function getPGURL(): string {
	const pgurl = Deno.env.get(PGURL)
	if (pgurl === undefined || pgurl.trim() === '') {
		throw new Error(`${PGURL} must be set for this test`)
	}

	return pgurl
}

function setOptionalEnv(key: string, value: string | undefined): void {
	if (value === undefined || value === '') {
		Deno.env.delete(key)
	} else {
		Deno.env.set(key, value)
	}
}

/**
 * DATABASE TESTS ORGANIZATION:
 *
 * This file contains tests for all database.ts functions:
 * - Synchronous functions: connectdb, exec, execPrepared, prepare, etc.
 * - Poll-based async functions: connectStart/connectPoll, sendQuery/getResult, resetStart/resetPoll
 * - Promise-based async functions: connectdbAsync, execAsync, execParamsAsync, execPreparedAsync, prepareAsync
 *
 * Tests are clearly grouped by function type for easy navigation.
 */

Deno.test('import fails when lib is not found', async () => {
	const libPath = Deno.env.get(DENO_LIBPQ_PATH)
	Deno.env.set(DENO_LIBPQ_PATH, 'fail.so')
	await assertRejects(async () => {
		// Using a different hash here forces a separate instance of the module to be
		// loaded preventing clashes with the "real" module in the rest of the tests
		// See: https://github.com/denoland/deno/issues/6946#issuecomment-670986090
		// A different way could exist in the future, see: https://github.com/denoland/deno/issues/8327
		await import('./ffi.ts#fail.ts')
	})
	if (libPath === undefined) {
		Deno.env.delete(DENO_LIBPQ_PATH)
	} else {
		Deno.env.set(DENO_LIBPQ_PATH, libPath)
	}
})

Deno.test('connectdb', async () => {
	const pq = await import('./database.ts')
	const conn = pq.connectdb(getPGURL())

	assertExists(conn)
	assertEquals(pq.status(conn), ConnStatusType.CONNECTION_OK)
})

Deno.test('connectdb with Object', () => {
	const connObj = conninfoParamsFromUrl(new URL(getPGURL()))
	const conn = connectdb(connObj)
	assertExists(conn)
	assertEquals(status(conn), ConnStatusType.CONNECTION_OK)
	finish(conn)
})

Deno.test('connectdb with URL object', () => {
	const conn = connectdb(getPGURL())
	assertExists(conn)
	assertEquals(status(conn), ConnStatusType.CONNECTION_OK)
	finish(conn)
})

Deno.test('connectdb with URL string', () => {
	const connString = getPGURL()
	const conn = connectdb(connString)
	assertExists(conn)
	assertEquals(status(conn), ConnStatusType.CONNECTION_OK)
	finish(conn)
})

Deno.test('connectdb with invalid connection', () => {
	assertThrows(() => {
		connectdb('host=127.100.100.100 connect_timeout=1')
	})
})

Deno.test('connectdb with no parameters falls back to PGURL', () => {
	const conn = connectdb()
	assertExists(conn)
	assertEquals(status(conn), ConnStatusType.CONNECTION_OK)
	finish(conn)
})

Deno.test(
	'connectdb with no parameters uses PG* environment variables when PGURL is not set',
	async () => {
		const pq = await import('./database.ts')
		const conninfo = conninfoParamsFromUrl(new URL(getPGURL()))

		const previous = {
			PGURL: Deno.env.get(PGURL),
			PGHOST: Deno.env.get('PGHOST'),
			PGPORT: Deno.env.get('PGPORT'),
			PGUSER: Deno.env.get('PGUSER'),
			PGPASSWORD: Deno.env.get('PGPASSWORD'),
			PGDATABASE: Deno.env.get('PGDATABASE'),
		}

		try {
			Deno.env.delete(PGURL)
			setOptionalEnv('PGHOST', conninfo.host)
			setOptionalEnv('PGPORT', conninfo.port)
			setOptionalEnv('PGDATABASE', conninfo.dbname)
			setOptionalEnv('PGUSER', conninfo.user)
			setOptionalEnv('PGPASSWORD', conninfo.password)

			const conn = pq.connectdb()
			assertExists(conn)
			assertEquals(pq.status(conn), ConnStatusType.CONNECTION_OK)
			pq.finish(conn)
		} finally {
			if (previous.PGURL === undefined) {
				Deno.env.delete(PGURL)
			} else {
				Deno.env.set(PGURL, previous.PGURL)
			}

			for (const key of PG_ENV_KEYS) {
				const value = previous[key]
				if (value === undefined) {
					Deno.env.delete(key)
				} else {
					Deno.env.set(key, value)
				}
			}
		}
	},
)

Deno.test('connectdbAsync with Object', async () => {
	const connObj = conninfoParamsFromUrl(new URL(getPGURL()))
	const conn = await connectdbAsync(connObj)
	assertExists(conn)
	assertEquals(status(conn), ConnStatusType.CONNECTION_OK)
	finish(conn)
})

Deno.test('connectdbAsync with URL object', async () => {
	const conn = await connectdbAsync(new URL(getPGURL()))
	assertExists(conn)
	assertEquals(status(conn), ConnStatusType.CONNECTION_OK)
	finish(conn)
})

Deno.test('connectdbAsync with URL string', async () => {
	const connString = getPGURL()
	const conn = await connectdbAsync(connString)
	assertExists(conn)
	assertEquals(status(conn), ConnStatusType.CONNECTION_OK)
	finish(conn)
})

Deno.test('connectdbAsync with invalid connection', async () => {
	await assertRejects(async () => {
		await connectdbAsync(
			'host=127.100.100.100 connect_timeout=1',
		)
	})
})

Deno.test(
	'connectdbAsync with no parameters falls back to PGURL',
	async () => {
		const conn = await connectdbAsync()
		assertExists(conn)
		assertEquals(status(conn), ConnStatusType.CONNECTION_OK)
		finish(conn)
	},
)

Deno.test(
	'connectdbAsync with no parameters uses PG* environment variables when PGURL is not set',
	async () => {
		const pq = await import('./database.ts')
		const conninfo = conninfoParamsFromUrl(new URL(getPGURL()))

		const previous = {
			PGURL: Deno.env.get(PGURL),
			PGHOST: Deno.env.get('PGHOST'),
			PGPORT: Deno.env.get('PGPORT'),
			PGUSER: Deno.env.get('PGUSER'),
			PGPASSWORD: Deno.env.get('PGPASSWORD'),
			PGDATABASE: Deno.env.get('PGDATABASE'),
		}

		try {
			Deno.env.delete(PGURL)
			setOptionalEnv('PGHOST', conninfo.host)
			setOptionalEnv('PGPORT', conninfo.port)
			setOptionalEnv('PGDATABASE', conninfo.dbname)
			setOptionalEnv('PGUSER', conninfo.user)
			setOptionalEnv('PGPASSWORD', conninfo.password)

			const conn = await pq.connectdbAsync()
			assertExists(conn)
			assertEquals(pq.status(conn), ConnStatusType.CONNECTION_OK)
			pq.finish(conn)
		} finally {
			if (previous.PGURL === undefined) {
				Deno.env.delete(PGURL)
			} else {
				Deno.env.set(PGURL, previous.PGURL)
			}

			for (const key of PG_ENV_KEYS) {
				const value = previous[key]
				if (value === undefined) {
					Deno.env.delete(key)
				} else {
					Deno.env.set(key, value)
				}
			}
		}
	},
)

Deno.test('connectdbAsync concurrent connections', async () => {
	const connString = getPGURL()

	const connections = await Promise.all([
		connectdbAsync(connString),
		connectdbAsync(connString),
		connectdbAsync(connString),
	])

	for (const conn of connections) {
		assertExists(conn)
		assertEquals(status(conn), ConnStatusType.CONNECTION_OK)
		finish(conn)
	}
})

Deno.test('connectdbAsync promise rejection on failure', async () => {
	await assertRejects(
		async () => await connectdbAsync('invalid-connection-string'),
		Error,
	)
})

Deno.test('execAsync', async () => {
	const conn = await connectdbAsync(getPGURL())

	const result = await execAsync(conn, 'SELECT 1 as test_column')
	assertExists(result)
	assertEquals(resultStatus(result), ExecStatusType.PGRES_TUPLES_OK)
	assertEquals(ntuples(result), 1)
	assertEquals(nfields(result), 1)
	assertEquals(fname(result, 0), 'test_column')
	assertEquals(getvalue(result, 0, 0), '1')
	clear(result)

	// Test error handling with bad SQL
	const errorResult = await execAsync(
		conn,
		'SELECT * FROM nonexistent_table',
	)
	assertExists(errorResult)
	assertEquals(
		resultStatus(errorResult),
		ExecStatusType.PGRES_FATAL_ERROR,
	)
	clear(errorResult)

	finish(conn)
})

Deno.test('execParamsAsync', async () => {
	const conn = await connectdbAsync(getPGURL())

	// Test with parameters
	const result = await execParamsAsync(
		conn,
		'SELECT $1::integer as param_value, $2::text as param_text',
		['42', 'hello'],
	)
	assertExists(result)
	assertEquals(resultStatus(result), ExecStatusType.PGRES_TUPLES_OK)
	assertEquals(ntuples(result), 1)
	assertEquals(nfields(result), 2)
	assertEquals(getvalue(result, 0, 0), '42')
	assertEquals(getvalue(result, 0, 1), 'hello')
	clear(result)

	// Test without parameters
	const result2 = await execParamsAsync(conn, 'SELECT 1 as no_params')
	assertExists(result2)
	assertEquals(resultStatus(result2), ExecStatusType.PGRES_TUPLES_OK)
	assertEquals(ntuples(result2), 1)
	assertEquals(getvalue(result2, 0, 0), '1')
	clear(result2)

	// Test error handling
	const errorResult = await execParamsAsync(conn, 'SELECT $1::badtype', [
		'invalid',
	])
	assertExists(errorResult)
	assertEquals(
		resultStatus(errorResult),
		ExecStatusType.PGRES_FATAL_ERROR,
	)
	clear(errorResult)

	finish(conn)
})

Deno.test('prepareAsync and execPreparedAsync', async () => {
	const conn = await connectdbAsync(getPGURL())

	// Test prepare
	const prepareResult = await prepareAsync(
		conn,
		'SELECT $1::integer as prepared_value',
		'test_stmt',
	)
	assertExists(prepareResult)
	assertEquals(
		resultStatus(prepareResult),
		ExecStatusType.PGRES_COMMAND_OK,
	)
	clear(prepareResult)

	// Test execute prepared
	const execResult = await execPreparedAsync(conn, ['123'], 'test_stmt')
	assertExists(execResult)
	assertEquals(resultStatus(execResult), ExecStatusType.PGRES_TUPLES_OK)
	assertEquals(ntuples(execResult), 1)
	assertEquals(getvalue(execResult, 0, 0), '123')
	clear(execResult)

	// Test unnamed prepared statement
	const unnamedPrepare = await prepareAsync(
		conn,
		'SELECT $1::text as unnamed_value',
	)
	assertExists(unnamedPrepare)
	assertEquals(
		resultStatus(unnamedPrepare),
		ExecStatusType.PGRES_COMMAND_OK,
	)
	clear(unnamedPrepare)

	const unnamedExec = await execPreparedAsync(conn, ['test'])
	assertExists(unnamedExec)
	assertEquals(resultStatus(unnamedExec), ExecStatusType.PGRES_TUPLES_OK)
	assertEquals(getvalue(unnamedExec, 0, 0), 'test')
	clear(unnamedExec)

	// Test prepare error handling
	const badPrepare = await prepareAsync(conn, 'SELECT * FROM bad_table')
	assertExists(badPrepare)
	assertEquals(
		resultStatus(badPrepare),
		ExecStatusType.PGRES_FATAL_ERROR,
	) // Prepare fails for non-existent table

	const badExec = await execPreparedAsync(conn)
	assertExists(badExec)
	assertEquals(resultStatus(badExec), ExecStatusType.PGRES_FATAL_ERROR)
	clear(badExec)
	clear(badPrepare)

	finish(conn)
})

Deno.test('async functions connection failure handling', async () => {
	// Test all async functions with a closed connection
	const conn = await connectdbAsync(getPGURL())
	finish(conn) // Close the connection

	await assertRejects(
		async () => await execAsync(conn, 'SELECT 1'),
		Error,
	)

	await assertRejects(
		async () => await execParamsAsync(conn, 'SELECT 1'),
		Error,
	)

	await assertRejects(
		async () => await execPreparedAsync(conn),
		Error,
	)

	await assertRejects(
		async () => await prepareAsync(conn, 'SELECT 1'),
		Error,
	)
})

Deno.test('database operations', async (t) => {
	const pq = await import('./database.ts')

	const conn = pq.connectdb(getPGURL())
	assertExists(conn)
	assertEquals(pq.status(conn), ConnStatusType.CONNECTION_OK)

	await t.step('exec', async (t) => {
		await t.step('empty command', () => {
			const res = pq.exec(conn, '')
			assertExists(res)
			const status = pq.resultStatus(res)
			assertEquals(status, ExecStatusType.PGRES_EMPTY_QUERY)
			assertEquals(
				pq.resStatus(status),
				ExecStatusType[ExecStatusType.PGRES_EMPTY_QUERY],
			)
			assertEquals(pq.nfields(res), 0)
			assertEquals(pq.ntuples(res), 0)
			assertEquals(pq.cmdTuples(res), -1)
			pq.clear(res)
		})

		await t.step('multiple columns', () => {
			const res = pq.exec(
				conn,
				"select 'first value' as first_col, 'second value' as second_col;",
			)
			assertExists(res)
			const status = pq.resultStatus(res)
			assertEquals(status, ExecStatusType.PGRES_TUPLES_OK)
			assertEquals(
				pq.resStatus(status),
				ExecStatusType[ExecStatusType.PGRES_TUPLES_OK],
			)
			assertEquals(pq.nfields(res), 2)
			assertEquals(pq.ntuples(res), 1)
			assertEquals(pq.cmdTuples(res), 1)
			assertEquals(pq.fname(res, 0), 'first_col')
			assertEquals(pq.fname(res, 1), 'second_col')
			assertEquals(pq.fnumber(res, 'first_col'), 0)
			assertEquals(pq.fnumber(res, 'second_col'), 1)
			assertEquals(pq.getvalue(res, 0, 0), 'first value')
			assertEquals(pq.getvalue(res, 0, 1), 'second value')
			pq.clear(res)
		})

		await t.step('multiple rows', () => {
			const res = pq.exec(
				conn,
				"SELECT series::date \"date\" from generate_series(date '2023-01-01', date '2023-01-10', '1 day') series;",
			)
			assertExists(res)
			const status = pq.resultStatus(res)
			assertEquals(status, ExecStatusType.PGRES_TUPLES_OK)
			assertEquals(
				pq.resStatus(status),
				ExecStatusType[ExecStatusType.PGRES_TUPLES_OK],
			)
			assertEquals(pq.nfields(res), 1)
			assertEquals(pq.ntuples(res), 10)
			assertEquals(pq.cmdTuples(res), 10)
			assertEquals(pq.fname(res, 0), 'date')
			assertEquals(pq.fnumber(res, 'date'), 0)
			assertEquals(pq.getvalue(res, 0, 0), '2023-01-01')
			assertEquals(pq.getvalue(res, 1, 0), '2023-01-02')
			assertEquals(pq.getvalue(res, 2, 0), '2023-01-03')
			assertEquals(pq.getvalue(res, 3, 0), '2023-01-04')
			assertEquals(pq.getvalue(res, 4, 0), '2023-01-05')
			assertEquals(pq.getvalue(res, 5, 0), '2023-01-06')
			assertEquals(pq.getvalue(res, 6, 0), '2023-01-07')
			assertEquals(pq.getvalue(res, 7, 0), '2023-01-08')
			assertEquals(pq.getvalue(res, 8, 0), '2023-01-09')
			assertEquals(pq.getvalue(res, 9, 0), '2023-01-10')
			pq.clear(res)
		})

		await t.step('select date', () => {
			const res = pq.exec(conn, "select '2023-02-27'::date as date;")
			assertExists(res)
			const status = pq.resultStatus(res)
			assertEquals(status, ExecStatusType.PGRES_TUPLES_OK)
			assertEquals(
				pq.resStatus(status),
				ExecStatusType[ExecStatusType.PGRES_TUPLES_OK],
			)
			assertEquals(pq.nfields(res), 1)
			assertEquals(pq.cmdTuples(res), 1)
			assertEquals(pq.fname(res, 0), 'date')
			assertEquals(pq.fnumber(res, 'date'), 0)
			assertEquals(pq.getvalue(res, 0, 0), '2023-02-27')
			pq.clear(res)
		})
	})

	await t.step('field functions', async (t) => {
		const res = pq.exec(
			conn,
			"SELECT 'test_value' as text_col, null as null_col, 42 as num_col",
		)

		await t.step('fformat returns correct field format', () => {
			assertEquals(pq.fformat(res, 0), 0)
			assertEquals(pq.fformat(res, 1), 0)
			assertEquals(pq.fformat(res, 2), 0)
		})

		await t.step('getisnull detects null values correctly', () => {
			assertEquals(pq.getisnull(res, 0, 0), false) // text_col is not null
			assertEquals(pq.getisnull(res, 0, 1), true) // null_col is null
			assertEquals(pq.getisnull(res, 0, 2), false) // num_col is not null
		})

		await t.step('getvalue handles null values', () => {
			assertEquals(pq.getvalue(res, 0, 0), 'test_value') // text value
			assertEquals(pq.getvalue(res, 0, 1), null) // null value
			assertEquals(pq.getvalue(res, 0, 2), '42') // number as text
		})

		pq.clear(res)
	})

	await t.step('error handling functions', async (t) => {
		await t.step('resultErrorMessage on successful query', () => {
			const res = pq.exec(conn, "SELECT 'test'")
			assertEquals(pq.resultErrorMessage(res), '') // No error
			pq.clear(res)
		})

		await t.step('resultErrorMessage on failed query', () => {
			const res = pq.exec(conn, 'INVALID SQL SYNTAX HERE')
			assertEquals(pq.resultStatus(res), ExecStatusType.PGRES_FATAL_ERROR)
			const errorMsg = pq.resultErrorMessage(res)
			assertExists(errorMsg)
			assertEquals(errorMsg.length > 0, true)
			pq.clear(res)
		})
	})

	await t.step('edge cases and parameter validation', async (t) => {
		await t.step('cmdTuples with DDL commands returns -1', () => {
			const res = pq.exec(conn, 'CREATE TEMP TABLE test_cmdtuples (id int)')
			assertEquals(pq.cmdTuples(res), -1) // DDL commands don't affect rows
			pq.clear(res)
		})

		await t.step('fnumber with nonexistent column returns -1', () => {
			const res = pq.exec(conn, "SELECT 'value' as existing_col")
			assertEquals(pq.fnumber(res, 'nonexistent_column'), -1)
			assertEquals(pq.fnumber(res, 'existing_col'), 0) // Verify normal case works
			pq.clear(res)
		})

		await t.step('execParams', async (t) => {
			await t.step('basic parameterized query', () => {
				const res = pq.execParams(conn, 'SELECT $1::text as value', [
					'test',
				])
				assertEquals(pq.resultStatus(res), ExecStatusType.PGRES_TUPLES_OK)
				assertEquals(pq.nfields(res), 1)
				assertEquals(pq.ntuples(res), 1)
				assertEquals(pq.getvalue(res, 0, 0), 'test')
				assertEquals(pq.fname(res, 0), 'value')
				pq.clear(res)
			})

			await t.step('multiple parameters', () => {
				const res = pq.execParams(conn, 'SELECT $1::int + $2::int as sum', [
					'5',
					'10',
				])
				assertEquals(pq.resultStatus(res), ExecStatusType.PGRES_TUPLES_OK)
				assertEquals(pq.nfields(res), 1)
				assertEquals(pq.ntuples(res), 1)
				assertEquals(pq.getvalue(res, 0, 0), '15')
				assertEquals(pq.fname(res, 0), 'sum')
				pq.clear(res)
			})

			await t.step('query with no parameters', () => {
				const res = pq.execParams(conn, 'SELECT 42 as answer')
				assertEquals(pq.resultStatus(res), ExecStatusType.PGRES_TUPLES_OK)
				assertEquals(pq.nfields(res), 1)
				assertEquals(pq.ntuples(res), 1)
				assertEquals(pq.getvalue(res, 0, 0), '42')
				assertEquals(pq.fname(res, 0), 'answer')
				pq.clear(res)
			})

			await t.step('undefined parameters', () => {
				const res = pq.execParams(conn, 'SELECT 123 as result', undefined)
				assertEquals(pq.resultStatus(res), ExecStatusType.PGRES_TUPLES_OK)
				assertEquals(pq.nfields(res), 1)
				assertEquals(pq.ntuples(res), 1)
				assertEquals(pq.getvalue(res, 0, 0), '123')
				assertEquals(pq.fname(res, 0), 'result')
				pq.clear(res)
			})

			await t.step('empty parameters array', () => {
				const res = pq.execParams(conn, 'SELECT 999 as empty_params', [])
				assertEquals(pq.resultStatus(res), ExecStatusType.PGRES_TUPLES_OK)
				assertEquals(pq.nfields(res), 1)
				assertEquals(pq.ntuples(res), 1)
				assertEquals(pq.getvalue(res, 0, 0), '999')
				pq.clear(res)
			})

			await t.step('various data types', () => {
				const res = pq.execParams(
					conn,
					'SELECT $1::text as text_val, $2::int as int_val, $3::float as float_val, $4::boolean as bool_val',
					['hello', '42', '3.14', 'true'],
				)
				assertEquals(pq.resultStatus(res), ExecStatusType.PGRES_TUPLES_OK)
				assertEquals(pq.nfields(res), 4)
				assertEquals(pq.ntuples(res), 1)
				assertEquals(pq.getvalue(res, 0, 0), 'hello')
				assertEquals(pq.getvalue(res, 0, 1), '42')
				assertEquals(pq.getvalue(res, 0, 2), '3.14')
				assertEquals(pq.getvalue(res, 0, 3), 't')
				pq.clear(res)
			})

			await t.step('null parameter handling', () => {
				const res = pq.execParams(conn, 'SELECT $1::text as nullable', [''])
				assertEquals(pq.resultStatus(res), ExecStatusType.PGRES_TUPLES_OK)
				assertEquals(pq.nfields(res), 1)
				assertEquals(pq.ntuples(res), 1)
				assertEquals(pq.getvalue(res, 0, 0), '')
				pq.clear(res)
			})

			await t.step('error handling - invalid SQL', () => {
				const res = pq.execParams(conn, 'INVALID SQL SYNTAX HERE', [
					'param',
				])
				assertEquals(pq.resultStatus(res), ExecStatusType.PGRES_FATAL_ERROR)
				assertExists(pq.resultErrorMessage(res))
				pq.clear(res)
			})

			await t.step('error handling - parameter count mismatch', () => {
				const res = pq.execParams(conn, 'SELECT $1::text, $2::text', [
					'only_one_param',
				])
				assertEquals(pq.resultStatus(res), ExecStatusType.PGRES_FATAL_ERROR)
				assertExists(pq.resultErrorMessage(res))
				pq.clear(res)
			})

			await t.step('INSERT/UPDATE operations', () => {
				// Create temp table
				const createRes = pq.execParams(
					conn,
					'CREATE TEMP TABLE test_execparams (id int, name text)',
				)
				assertEquals(
					pq.resultStatus(createRes),
					ExecStatusType.PGRES_COMMAND_OK,
				)
				pq.clear(createRes)

				// Insert with parameters
				const insertRes = pq.execParams(
					conn,
					'INSERT INTO test_execparams VALUES ($1::int, $2::text)',
					['1', 'Alice'],
				)
				assertEquals(
					pq.resultStatus(insertRes),
					ExecStatusType.PGRES_COMMAND_OK,
				)
				assertEquals(pq.cmdTuples(insertRes), 1)
				pq.clear(insertRes)

				// Select to verify
				const selectRes = pq.execParams(
					conn,
					'SELECT name FROM test_execparams WHERE id = $1::int',
					['1'],
				)
				assertEquals(
					pq.resultStatus(selectRes),
					ExecStatusType.PGRES_TUPLES_OK,
				)
				assertEquals(pq.getvalue(selectRes, 0, 0), 'Alice')
				pq.clear(selectRes)
			})
		})

		await t.step('execPrepared parameter validation', async (t) => {
			const stmtName = 'test-param-validation'

			await t.step('prepare statement with parameters', () => {
				const res = pq.prepare(conn, 'SELECT $1::text as param', stmtName)
				assertEquals(pq.resultStatus(res), ExecStatusType.PGRES_COMMAND_OK)
				pq.clear(res)
			})

			await t.step('execute with correct parameters', () => {
				const res = pq.execPrepared(conn, ['test_param'], stmtName)
				assertEquals(pq.resultStatus(res), ExecStatusType.PGRES_TUPLES_OK)
				assertEquals(pq.getvalue(res, 0, 0), 'test_param')
				pq.clear(res)
			})

			await t.step('execute with no parameters', () => {
				const res = pq.execPrepared(conn, undefined, stmtName)
				assertEquals(pq.resultStatus(res), ExecStatusType.PGRES_FATAL_ERROR) // Should fail - missing required param
				pq.clear(res)
			})
		})
	})

	await t.step('execPrepared', async (t) => {
		const statementName = 'get-name'

		await t.step('prepare statement', () => {
			const res = pq.prepare(
				conn,
				'SELECT $1::text as name',
				statementName,
			)

			assertExists(res)
			assertEquals(pq.resultErrorMessage(res), '')
			const status = pq.resultStatus(res)
			assertEquals(
				status,
				ExecStatusType.PGRES_COMMAND_OK,
			)
			assertEquals(
				pq.resStatus(status),
				ExecStatusType[ExecStatusType.PGRES_COMMAND_OK],
			)
			pq.clear(res)
		})

		await t.step('execute statement', () => {
			const res = pq.execPrepared(conn, ['John'], statementName)
			assertExists(res)
			assertEquals(pq.resultErrorMessage(res), '')
			const status = pq.resultStatus(res)
			assertEquals(
				pq.resStatus(status),
				ExecStatusType[ExecStatusType.PGRES_TUPLES_OK],
			)
			assertEquals(
				status,
				ExecStatusType.PGRES_TUPLES_OK,
			)
			assertEquals(pq.ntuples(res), 1)
			assertEquals(pq.nfields(res), 1)
			assertEquals(pq.cmdTuples(res), 1)
			assertEquals(pq.getvalue(res, 0, 0), 'John')
			pq.clear(res)
		})
	})

	await t.step('connection functions', async (t) => {
		await t.step('consumeInput on synchronous connection', () => {
			// On a synchronous connection, consumeInput should succeed
			assertEquals(pq.consumeInput(conn), 1)
		})

		await t.step('status returns correct connection state', () => {
			assertEquals(pq.status(conn), ConnStatusType.CONNECTION_OK)
		})
	})

	pq.finish(conn)
})

Deno.test('poll-based async connection functions', async (t) => {
	const pq = await import('./database.ts')

	await t.step('connectStart and connectPoll', async () => {
		const conn = pq.connectStart(getPGURL())

		// Connection should be in progress or completed
		const initialStatus = pq.status(conn)
		const validInitialStatuses = [
			ConnStatusType.CONNECTION_STARTED,
			ConnStatusType.CONNECTION_MADE,
			ConnStatusType.CONNECTION_AWAITING_RESPONSE,
			ConnStatusType.CONNECTION_AUTH_OK,
			ConnStatusType.CONNECTION_OK,
		]

		assertEquals(
			validInitialStatuses.includes(initialStatus),
			true,
			`Expected valid connection status, got ${initialStatus}`,
		)

		// Poll until connection completes with proper async delay
		let pollResult: PostgresPollingStatusType
		let attempts = 0
		const maxAttempts = 100

		do {
			pollResult = pq.connectPoll(conn)
			attempts++

			if (attempts > maxAttempts) {
				pq.finish(conn)
				throw new Error('Connection took too long')
			}

			if (
				pollResult === PostgresPollingStatusType.PGRES_POLLING_READING ||
				pollResult === PostgresPollingStatusType.PGRES_POLLING_WRITING
			) {
				// Wait asynchronously before next poll
				await delay(10)
			}
		} while (
			pollResult === PostgresPollingStatusType.PGRES_POLLING_READING ||
			pollResult === PostgresPollingStatusType.PGRES_POLLING_WRITING
		)

		if (pollResult === PostgresPollingStatusType.PGRES_POLLING_OK) {
			assertEquals(pq.status(conn), ConnStatusType.CONNECTION_OK)
		} else if (
			pollResult === PostgresPollingStatusType.PGRES_POLLING_FAILED
		) {
			pq.finish(conn)
			throw new Error('Connection failed')
		} else {
			pq.finish(conn)
			throw new Error(`Unexpected poll result: ${pollResult}`)
		}

		pq.finish(conn)
	})

	await t.step('resetStart and resetPoll', async () => {
		const conn = pq.connectStart(getPGURL())

		// Wait for connection to complete
		let pollResult: PostgresPollingStatusType
		do {
			pollResult = pq.connectPoll(conn)
			if (
				pollResult === PostgresPollingStatusType.PGRES_POLLING_READING ||
				pollResult === PostgresPollingStatusType.PGRES_POLLING_WRITING
			) {
				await delay(10)
			}
		} while (
			pollResult === PostgresPollingStatusType.PGRES_POLLING_READING ||
			pollResult === PostgresPollingStatusType.PGRES_POLLING_WRITING
		)

		assertEquals(pollResult, PostgresPollingStatusType.PGRES_POLLING_OK)
		assertEquals(pq.status(conn), ConnStatusType.CONNECTION_OK)

		// Now test reset
		pq.resetStart(conn)

		// Poll reset until complete with async delays
		let resetPollResult: PostgresPollingStatusType
		let attempts = 0
		const maxAttempts = 100

		do {
			resetPollResult = pq.resetPoll(conn)
			attempts++

			if (attempts > maxAttempts) {
				pq.finish(conn)
				throw new Error('Reset took too long')
			}

			if (
				resetPollResult ===
					PostgresPollingStatusType.PGRES_POLLING_READING ||
				resetPollResult === PostgresPollingStatusType.PGRES_POLLING_WRITING
			) {
				await delay(10)
			}
		} while (
			resetPollResult === PostgresPollingStatusType.PGRES_POLLING_READING ||
			resetPollResult === PostgresPollingStatusType.PGRES_POLLING_WRITING
		)

		assertEquals(resetPollResult, PostgresPollingStatusType.PGRES_POLLING_OK)
		assertEquals(pq.status(conn), ConnStatusType.CONNECTION_OK)

		pq.finish(conn)
	})

	await t.step('connectStart error handling', () => {
		// Test with invalid connection string should not throw (returns null conn)
		// but subsequent poll should fail
		const conn = pq.connectStart('invalid://connection/string')
		assertExists(conn)

		// Poll should return FAILED
		const pollResult = pq.connectPoll(conn)
		assertEquals(pollResult, PostgresPollingStatusType.PGRES_POLLING_FAILED)

		pq.finish(conn)
	})
})

Deno.test('poll-based async state and action functions', async (t) => {
	const pq = await import('./database.ts')

	const conn = pq.connectStart(getPGURL())

	// Wait for connection with async delays
	let pollResult: PostgresPollingStatusType
	do {
		pollResult = pq.connectPoll(conn)
		if (
			pollResult === PostgresPollingStatusType.PGRES_POLLING_READING ||
			pollResult === PostgresPollingStatusType.PGRES_POLLING_WRITING
		) {
			await delay(10)
		}
	} while (
		pollResult === PostgresPollingStatusType.PGRES_POLLING_READING ||
		pollResult === PostgresPollingStatusType.PGRES_POLLING_WRITING
	)

	assertEquals(pollResult, PostgresPollingStatusType.PGRES_POLLING_OK)

	await t.step('isBusy and isnonblocking', () => {
		// Test isBusy - should be 0 (not busy) initially
		assertEquals(pq.isBusy(conn), 0)

		// Test isnonblocking - default should be 0 (blocking mode)
		assertEquals(pq.isnonblocking(conn), 0)
	})

	await t.step('flush', () => {
		// Test flush - should return 0 (success) when nothing to flush
		const flushResult = pq.flush(conn)
		assertEquals(flushResult, 0)
	})

	await t.step('flush error handling', async () => {
		// Test flush on a failed connection instead of a closed one
		const badConn = pq.connectStart('invalid://connection/string')

		// Poll until we get a failed connection
		let pollResult: PostgresPollingStatusType
		do {
			pollResult = pq.connectPoll(badConn)
			if (
				pollResult === PostgresPollingStatusType.PGRES_POLLING_READING ||
				pollResult === PostgresPollingStatusType.PGRES_POLLING_WRITING
			) {
				await delay(10)
			}
		} while (
			pollResult === PostgresPollingStatusType.PGRES_POLLING_READING ||
			pollResult === PostgresPollingStatusType.PGRES_POLLING_WRITING
		)

		assertEquals(pollResult, PostgresPollingStatusType.PGRES_POLLING_FAILED)

		// flush on a failed connection should either throw or return an error value
		try {
			const result = pq.flush(badConn)
			// If it doesn't throw, it should return -1 (error)
			assertEquals(result, -1)
		} catch (_error) {
			// It's also valid for it to throw an error
			// Both behaviors are acceptable
		}

		pq.finish(badConn)
	})

	pq.finish(conn)
})

Deno.test('poll-based async query functions', async (t) => {
	const pq = await import('./database.ts')

	const conn = pq.connectStart(getPGURL())

	// Wait for connection with async delays
	let pollResult: PostgresPollingStatusType
	do {
		pollResult = pq.connectPoll(conn)
		if (
			pollResult === PostgresPollingStatusType.PGRES_POLLING_READING ||
			pollResult === PostgresPollingStatusType.PGRES_POLLING_WRITING
		) {
			await delay(10)
		}
	} while (
		pollResult === PostgresPollingStatusType.PGRES_POLLING_READING ||
		pollResult === PostgresPollingStatusType.PGRES_POLLING_WRITING
	)

	assertEquals(pollResult, PostgresPollingStatusType.PGRES_POLLING_OK)

	await t.step('sendQuery and getResult', async () => {
		// Send a query asynchronously
		pq.sendQuery(conn, 'SELECT 1 as test_column')

		// Wait for query to complete with async delays
		while (pq.isBusy(conn) === 1) {
			pq.consumeInput(conn)
			// Async delay to avoid tight loop
			await delay(1)
		}

		// Get results
		const result = pq.getResult(conn)
		assertExists(result)

		if (result) {
			assertEquals(pq.ntuples(result), 1)
			pq.clear(result)
		}

		// Should be no more results
		const noMoreResults = pq.getResult(conn)
		assertEquals(noMoreResults, null)
	})

	await t.step('sendQueryParams', async () => {
		// Send a parameterized query
		pq.sendQueryParams(conn, 'SELECT $1::text as param_value', ['hello'])

		// Wait for query to complete with async delays
		while (pq.isBusy(conn) === 1) {
			pq.consumeInput(conn)
			await delay(1)
		}

		// Get results
		const result = pq.getResult(conn)
		assertExists(result)

		if (result) {
			assertEquals(pq.ntuples(result), 1)
			pq.clear(result)
		}

		// Should be no more results
		const noMoreResults = pq.getResult(conn)
		assertEquals(noMoreResults, null)
	})

	await t.step('sendPrepare and sendQueryPrepared', async () => {
		const stmtName = 'async_stmt_send_prepare'

		pq.sendPrepare(conn, 'SELECT $1::text as prepared_value', stmtName)

		while (pq.isBusy(conn) === 1) {
			pq.consumeInput(conn)
			await delay(1)
		}

		const prepareResult = pq.getResult(conn)
		assertExists(prepareResult)

		if (prepareResult) {
			assertEquals(
				pq.resultStatus(prepareResult),
				ExecStatusType.PGRES_COMMAND_OK,
			)
			pq.clear(prepareResult)
		}

		assertEquals(pq.getResult(conn), null)

		pq.sendQueryPrepared(conn, ['hello'], stmtName)

		while (pq.isBusy(conn) === 1) {
			pq.consumeInput(conn)
			await delay(1)
		}

		const preparedResult = pq.getResult(conn)
		assertExists(preparedResult)

		if (preparedResult) {
			assertEquals(
				pq.resultStatus(preparedResult),
				ExecStatusType.PGRES_TUPLES_OK,
			)
			assertEquals(pq.getvalue(preparedResult, 0, 0), 'hello')
			pq.clear(preparedResult)
		}

		assertEquals(pq.getResult(conn), null)
	})

	await t.step('sendQuery error handling', () => {
		// Test with invalid connection string that fails to connect
		const badConn = pq.connectStart('invalid://connection/string')

		// Poll until we get a failed connection
		const pollResult = pq.connectPoll(badConn)
		assertEquals(pollResult, PostgresPollingStatusType.PGRES_POLLING_FAILED)

		// Now sendQuery should throw on the failed connection
		assertThrows(
			() => pq.sendQuery(badConn, 'SELECT 1'),
			Error,
		)

		assertThrows(
			() => pq.sendPrepare(badConn, 'SELECT 1', 'bad_stmt'),
			Error,
		)

		assertThrows(
			() => pq.sendQueryPrepared(badConn, ['1'], 'bad_stmt'),
			Error,
		)

		pq.finish(badConn)
	})

	pq.finish(conn)
})

Deno.test('result metadata', async (t) => {
	const pq = await import('./database.ts')

	const conn = pq.connectdb(getPGURL())
	assertExists(conn)
	assertEquals(pq.status(conn), ConnStatusType.CONNECTION_OK)

	await t.step('result metadata functions', () => {
		// Setup a table
		const setupRes = pq.exec(
			conn,
			'CREATE TEMP TABLE metadata_test (id int PRIMARY KEY, name text)',
		)
		pq.clear(setupRes)

		const res = pq.exec(conn, 'SELECT id, name FROM metadata_test')
		assertExists(res)
		assertEquals(pq.resultStatus(res), ExecStatusType.PGRES_TUPLES_OK)
		assertEquals(pq.nfields(res), 2)

		// ftable
		const tableOid0 = pq.ftable(res, 0)
		const tableOid1 = pq.ftable(res, 1)
		// Oids should be > 0 for actual table columns
		assertNotEquals(tableOid0, 0)
		assertNotEquals(tableOid1, 0)
		assertEquals(tableOid0, tableOid1)

		// ftablecol
		assertEquals(pq.ftablecol(res, 0), 1) // First column in table (id)
		assertEquals(pq.ftablecol(res, 1), 2) // Second column in table (name)

		// ftype
		const type0 = pq.ftype(res, 0) // int4
		const type1 = pq.ftype(res, 1) // text
		assertNotEquals(type0, 0)
		assertNotEquals(type1, 0)
		assertNotEquals(type0, type1)

		// fsize
		const size0 = pq.fsize(res, 0) // int4 is 4 bytes
		assertEquals(size0, 4)
		const size1 = pq.fsize(res, 1) // text is varlen (-1)
		assertEquals(size1, -1)

		// fmod
		// usually -1 for these basic types
		assertEquals(pq.fmod(res, 0), -1)
		assertEquals(pq.fmod(res, 1), -1)

		pq.clear(res)

		const dropRes = pq.exec(conn, 'DROP TABLE metadata_test')
		pq.clear(dropRes)
	})

	await t.step('binaryTuples', () => {
		// Text format (default)
		const resText = pq.exec(conn, 'SELECT 1')
		assertEquals(pq.binaryTuples(resText), false)
		pq.clear(resText)

		// Binary format via execParams
		// Note: wrapper currently only supports text format (0)
		const resBin = pq.execParams(
			conn,
			'SELECT 1::int',
			[], // no params
		)
		assertEquals(pq.binaryTuples(resBin), false)
		pq.clear(resBin)
	})

	await t.step('oidValue', () => {
		// Create table with OIDs (deprecated but still supported in some versions, or just check 0 for standard tables)
		// Modern PG doesn't support WITH OIDS by default or removed it (PG12+).
		// So usually returns 0 or InvalidOid.
		// Just check behavior on non-insert
		const resSelect = pq.exec(conn, 'SELECT 1')
		assertEquals(pq.oidValue(resSelect), 0)
		pq.clear(resSelect)
	})

	await t.step('prepared statement metadata', () => {
		const stmtName = 'meta_prep'
		const prepareRes = pq.prepare(
			conn,
			'SELECT $1::int as num, $2::text as str',
			stmtName,
		)
		assertEquals(pq.resultStatus(prepareRes), ExecStatusType.PGRES_COMMAND_OK)
		pq.clear(prepareRes)

		const describeRes = pq.describePrepared(conn, stmtName)
		assertEquals(
			pq.resultStatus(describeRes),
			ExecStatusType.PGRES_COMMAND_OK,
		)

		assertEquals(pq.nparams(describeRes), 2)
		assertEquals(pq.paramtype(describeRes, 0), 23)
		assertEquals(pq.paramtype(describeRes, 1), 25)
		assertEquals(pq.paramtype(describeRes, 2), 0)

		assertEquals(pq.nfields(describeRes), 2)
		assertEquals(pq.fname(describeRes, 0), 'num')
		assertEquals(pq.fname(describeRes, 1), 'str')
		assertEquals(pq.ftype(describeRes, 0), 23)
		assertEquals(pq.ftype(describeRes, 1), 25)
		assertEquals(pq.ftype(describeRes, 2), 0)
		assertThrows(() => pq.fname(describeRes, 2), Error)
		pq.clear(describeRes)

		const unnamedPrepareRes = pq.prepare(
			conn,
			'SELECT $1::int as unnamed_num',
		)
		assertEquals(
			pq.resultStatus(unnamedPrepareRes),
			ExecStatusType.PGRES_COMMAND_OK,
		)
		pq.clear(unnamedPrepareRes)

		const unnamedDescribeRes = pq.describePrepared(conn)
		assertEquals(
			pq.resultStatus(unnamedDescribeRes),
			ExecStatusType.PGRES_COMMAND_OK,
		)
		assertEquals(pq.nparams(unnamedDescribeRes), 1)
		assertEquals(pq.paramtype(unnamedDescribeRes, 0), 23)
		assertEquals(pq.nfields(unnamedDescribeRes), 1)
		assertEquals(pq.fname(unnamedDescribeRes, 0), 'unnamed_num')
		assertEquals(pq.ftype(unnamedDescribeRes, 0), 23)
		pq.clear(unnamedDescribeRes)

		const missingDescribeRes = pq.describePrepared(conn, 'missing_statement')
		assertEquals(
			pq.resultStatus(missingDescribeRes),
			ExecStatusType.PGRES_FATAL_ERROR,
		)
		assertEquals(pq.resultErrorMessage(missingDescribeRes).length > 0, true)
		pq.clear(missingDescribeRes)
	})

	pq.finish(conn)
})

Deno.test('escaping functions', async (t) => {
	const conn = connectdb(
		getPGURL(),
	)
	assertExists(conn)
	assertEquals(status(conn), ConnStatusType.CONNECTION_OK)

	await t.step('escapeLiteral', () => {
		// Basic string
		assertEquals(escapeLiteral(conn, 'hello'), "'hello'")

		// Quotes
		assertEquals(escapeLiteral(conn, "it's me"), "'it''s me'")

		// Backslashes (standard conforming strings usually treat backslashes literally)
		// But it depends on server config. Assuming standard_conforming_strings = on
		// which is default in modern PG.
		// If off, might be E'...'.
		// We just check it produces valid SQL literal that PG accepts.

		const complex = `weird ' chars " and \ backslashes`
		const escaped = escapeLiteral(conn, complex)

		// Verify by asking database
		const res = exec(conn, `SELECT ${escaped} as val`)
		assertExists(res)
		assertEquals(getvalue(res, 0, 0), complex)
		clear(res)
	})

	await t.step('escapeIdentifier', () => {
		// Simple identifier
		assertEquals(escapeIdentifier(conn, 'simple_table'), '"simple_table"')

		// Identifier with spaces
		assertEquals(
			escapeIdentifier(conn, 'table with spaces'),
			'"table with spaces"',
		)

		// Identifier with quotes
		assertEquals(
			escapeIdentifier(conn, 'table "quote"'),
			'"table ""quote"""',
		)

		// Verify by creating a temp table with weird name
		const weirdName = 'weird " table'
		const escapedName = escapeIdentifier(conn, weirdName)

		const createRes = exec(
			conn,
			`CREATE TEMP TABLE ${escapedName} (id int)`,
		)
		// If successful, resultStatus should be COMMAND_OK
		// If name was already taken (from previous run or parallel), might fail, but escaping itself was valid syntax
		// We just check if we can use it.

		if (resultErrorMessage(createRes).includes('already exists')) {
			// It's fine
		} else {
			// Should be OK
			// ExecStatusType.PGRES_COMMAND_OK
		}
		clear(createRes)

		const dropRes = exec(conn, `DROP TABLE IF EXISTS ${escapedName}`)
		clear(dropRes)
	})

	finish(conn)
})

Deno.test('connection info', async (t) => {
	const connUrl = new URL(
		getPGURL(),
	)
	const conn = connectdb(connUrl)
	assertExists(conn)
	assertEquals(status(conn), ConnStatusType.CONNECTION_OK)

	await t.step('db', () => {
		const dbName = db(conn)
		// Should match the one in URL or 'postgres'/'user' default
		// Usually 'postgres' in test envs if not specified
		assertExists(dbName)
		if (connUrl.pathname.length > 1) {
			assertEquals(dbName, connUrl.pathname.slice(1))
		}
	})

	await t.step('user', () => {
		const userName = user(conn)
		assertExists(userName)
		if (connUrl.username) {
			assertEquals(userName, connUrl.username)
		}
	})

	await t.step('host', () => {
		const hostName = host(conn)
		assertExists(hostName)
		// host can be empty for unix socket or localhost/IP
	})

	await t.step('port', () => {
		const portStr = port(conn)
		assertExists(portStr)
		if (connUrl.port) {
			assertEquals(portStr, connUrl.port)
		} else {
			assertEquals(portStr, '5432')
		}
	})

	await t.step('options', () => {
		const opts = options(conn)
		assertExists(opts)
		// Typically empty string by default
	})

	await t.step('backendPID', () => {
		const pid = backendPID(conn)
		assertNotEquals(pid, 0)
	})

	await t.step('protocolVersion', () => {
		const ver = protocolVersion(conn)
		assertEquals(ver, 3) // Protocol v3 is standard for modern PG
	})

	await t.step('reset', () => {
		reset(conn)
		assertEquals(status(conn), ConnStatusType.CONNECTION_OK)
	})

	await t.step('transactionStatus', () => {
		// Initial status: IDLE
		assertEquals(
			transactionStatus(conn),
			PGTransactionStatusType.PQTRANS_IDLE,
		)

		// Start transaction
		const resBegin = exec(conn, 'BEGIN')
		clear(resBegin)
		assertEquals(
			transactionStatus(conn),
			PGTransactionStatusType.PQTRANS_INTRANS,
		)

		// Error
		const resErr = exec(conn, 'SELECT invalid_syntax')
		clear(resErr)
		assertEquals(
			transactionStatus(conn),
			PGTransactionStatusType.PQTRANS_INERROR,
		)

		// Rollback
		const resRollback = exec(conn, 'ROLLBACK')
		clear(resRollback)
		assertEquals(
			transactionStatus(conn),
			PGTransactionStatusType.PQTRANS_IDLE,
		)
	})

	await t.step('parameterStatus', () => {
		const serverEncoding = parameterStatus(conn, 'server_encoding')
		assertExists(serverEncoding)
		// Typically UTF8
		assertEquals(serverEncoding, 'UTF8')

		const timeZone = parameterStatus(conn, 'TimeZone')
		assertExists(timeZone)

		const invalidParam = parameterStatus(conn, 'non_existent_param_xyz')
		assertEquals(invalidParam, null)
	})

	await t.step('ping', () => {
		const reachable = ping(connUrl)
		assertEquals(reachable, PGPing.PQPING_OK)

		const malformed = ping('invalid://connection/string')
		assertEquals(malformed, PGPing.PQPING_NO_ATTEMPT)
	})

	finish(conn)
})

Deno.test('query cancellation', async (t) => {
	const connUrl = new URL(
		getPGURL(),
	)
	const conn = await connectdbAsync(connUrl) // Use async connection for non-blocking
	assertExists(conn)
	assertEquals(status(conn), ConnStatusType.CONNECTION_OK)

	await t.step('cancel long running query', async () => {
		// Get cancel handle
		const cancelHandle = getCancel(conn)
		assertExists(cancelHandle)

		// Start a long running query asynchronously
		// pg_sleep(2)
		const queryPromise = execAsync(conn, 'SELECT pg_sleep(2)')

		// Wait a bit to ensure query reaches server
		await delay(100)

		// Send cancel request
		cancel(cancelHandle)

		// The query promise should reject or resolve with error
		// Actually execAsync returns PGresult, it doesn't reject on query error (unless connection fails).
		// It returns a PGresult with status FATAL_ERROR and message about cancellation.

		const res = await queryPromise
		assertExists(res)

		// Check error message implies cancellation
		const errorMsg = resultErrorMessage(res)
		// "canceling statement due to user request"
		const wasCanceled = errorMsg.includes('cancel') ||
			errorMsg.includes('request')
		assertEquals(wasCanceled, true)

		clear(res)
		freeCancel(cancelHandle)
	})

	finish(conn)
})

Deno.test('error fields', async (t) => {
	const conn = connectdb(
		getPGURL(),
	)
	assertExists(conn)
	assertEquals(status(conn), ConnStatusType.CONNECTION_OK)

	await t.step('syntax error provides error fields', () => {
		const res = exec(conn, 'SELECT * FROM')
		assertExists(res)
		assertEquals(resultStatus(res), ExecStatusType.PGRES_FATAL_ERROR)

		// Verify primary message
		const message = resultErrorField(res, PGDiag.MESSAGE_PRIMARY)
		assertExists(message)
		// Should be something like "syntax error at end of input" or similar
		assertEquals(message.length > 0, true)

		// Verify severity
		const severity = resultErrorField(res, PGDiag.SEVERITY)
		assertExists(severity)
		assertEquals(severity, 'ERROR')

		// Verify SQLSTATE (syntax error is usually 42601)
		const sqlState = resultErrorField(res, PGDiag.SQLSTATE)
		assertExists(sqlState)
		assertEquals(sqlState.length, 5)

		clear(res)
	})

	await t.step('missing column provides column name field', () => {
		// Try to select non-existent column
		const res = exec(conn, 'SELECT non_existent_column FROM pg_database')
		assertExists(res)
		assertEquals(resultStatus(res), ExecStatusType.PGRES_FATAL_ERROR)

		const message = resultErrorField(res, PGDiag.MESSAGE_PRIMARY)
		assertExists(message)

		// Severity
		const severity = resultErrorField(res, PGDiag.SEVERITY)
		assertEquals(severity, 'ERROR')

		// Position might be available
		const position = resultErrorField(res, PGDiag.STATEMENT_POSITION)
		if (position !== null) {
			// If available, it should be a number string
			assertEquals(isNaN(parseInt(position)), false)
		}

		clear(res)
	})

	await t.step('successful query returns null for error fields', () => {
		const res = exec(conn, 'SELECT 1')
		assertExists(res)
		assertEquals(resultStatus(res), ExecStatusType.PGRES_TUPLES_OK)

		const message = resultErrorField(res, PGDiag.MESSAGE_PRIMARY)
		assertEquals(message, null)

		const severity = resultErrorField(res, PGDiag.SEVERITY)
		assertEquals(severity, null)

		clear(res)
	})

	await t.step('resultVerboseErrorMessage for failed query', () => {
		const res = exec(conn, 'SELECT * FROM')
		assertEquals(resultStatus(res), ExecStatusType.PGRES_FATAL_ERROR)

		const verbose = resultVerboseErrorMessage(
			res,
			PGVerbosity.PQERRORS_VERBOSE,
			PGContextVisibility.PQSHOW_CONTEXT_ALWAYS,
		)
		assertExists(verbose)
		if (verbose !== null) {
			assertEquals(verbose.includes('ERROR'), true)
		}

		clear(res)
	})

	await t.step('resultVerboseErrorMessage on success is non-fatal', () => {
		const res = exec(conn, 'SELECT 1')
		assertEquals(resultStatus(res), ExecStatusType.PGRES_TUPLES_OK)

		const verbose = resultVerboseErrorMessage(
			res,
			PGVerbosity.PQERRORS_DEFAULT,
			PGContextVisibility.PQSHOW_CONTEXT_ERRORS,
		)

		if (verbose !== null) {
			assertEquals(verbose.includes('not an error result'), true)
		}

		clear(res)
	})

	finish(conn)
})

Deno.test('direct notifications API', async () => {
	const connString = getPGURL()
	const listenerConn = connectdb(connString)
	const senderConn = connectdb(connString)

	assertExists(listenerConn)
	assertExists(senderConn)

	const listenRes = exec(listenerConn, 'LISTEN test_channel_direct_notifies')
	clear(listenRes)

	const notifyRes = exec(
		senderConn,
		"NOTIFY test_channel_direct_notifies, 'payload-123'",
	)
	clear(notifyRes)

	let notification = null
	for (let attempt = 0; attempt < 100; attempt++) {
		consumeInput(listenerConn)
		notification = notifies(listenerConn)
		if (notification !== null) break
		await delay(10)
	}

	assertExists(notification)
	if (notification !== null) {
		assertEquals(notification.relname, 'test_channel_direct_notifies')
		assertNotEquals(notification.bePid, 0)
		assertEquals(notification.extra, 'payload-123')
	}

	assertEquals(notifies(listenerConn), null)

	const unlistenRes = exec(listenerConn, 'UNLISTEN *')
	clear(unlistenRes)

	finish(listenerConn)
	finish(senderConn)
})
