import { delay } from '@std/async/delay'

import {
	connectPoll,
	connectStart,
	consumeInput,
	finish,
	flush,
	getResult,
	isBusy,
	resetPoll,
	resetStart,
	sendQuery,
	sendQueryParams,
	sendQueryPrepared,
	status,
} from './database.ts'
import type { PGconn, PGresult } from './ffi.ts'
import { ConnStatusType } from './ffi.ts'

/**
 * High-level async connection to PostgreSQL using proper libpq async patterns
 * @param {string | URL | Record<string,string>} conninfo - The database connection info
 * @returns {Promise<PGconn>} A Promise that resolves to a database connection pointer
 * @throws {Error} When connection fails
 */
export async function connect(
	conninfo: string | URL | Record<string, string> = '',
): Promise<PGconn> {
	const conn = connectStart(conninfo)

	try {
		while (true) {
			const pollStatus = connectPoll(conn)

			switch (pollStatus) {
				case 3: // PGRES_POLLING_OK
					if (status(conn) === ConnStatusType.CONNECTION_OK) {
						return conn
					} else {
						finish(conn)
						throw new Error('Connection failed')
					}

				case 0: // PGRES_POLLING_FAILED
					finish(conn)
					throw new Error('Connection failed')

				case 1: // PGRES_POLLING_READING
				case 2: // PGRES_POLLING_WRITING
					// Wait a short time and poll again
					await delay(10)
					break

				default:
					finish(conn)
					throw new Error(`Unknown polling status: ${pollStatus}`)
			}
		}
	} catch (error) {
		finish(conn)
		throw error
	}
}

/**
 * High-level async connection reset
 * @param {PGconn} conn - The connection to reset
 * @returns {Promise<void>} A Promise that resolves when reset is complete
 * @throws {Error} When reset fails
 */
export async function reset(conn: PGconn): Promise<void> {
	resetStart(conn)

	while (true) {
		const pollStatus = resetPoll(conn)

		switch (pollStatus) {
			case 3: // PGRES_POLLING_OK
				if (status(conn) === ConnStatusType.CONNECTION_OK) {
					return
				} else {
					throw new Error('Reset failed')
				}

			case 0: // PGRES_POLLING_FAILED
				throw new Error('Reset failed')

			case 1: // PGRES_POLLING_READING
			case 2: // PGRES_POLLING_WRITING
				// Wait a short time and poll again
				await delay(10)
				break

			default:
				throw new Error(`Unknown polling status: ${pollStatus}`)
		}
	}
}

/**
 * Execute a query asynchronously and return all results
 * @param {PGconn} conn - The connection to use
 * @param {string} command - The SQL command to execute
 * @returns {Promise<PGresult[]>} A Promise that resolves to array of results
 * @throws {Error} When query execution fails
 */
export async function query(
	conn: PGconn,
	command: string,
): Promise<PGresult[]> {
	// Send the query
	sendQuery(conn, command)

	// Wait for query to complete and collect results
	return await collectResults(conn)
}

/**
 * Execute a parameterized query asynchronously and return all results
 * @param {PGconn} conn - The connection to use
 * @param {string} command - The SQL command to execute
 * @param {string[]} [params] - Parameters for the query
 * @returns {Promise<PGresult[]>} A Promise that resolves to array of results
 * @throws {Error} When query execution fails
 */
export async function queryParams(
	conn: PGconn,
	command: string,
	params?: string[],
): Promise<PGresult[]> {
	// Send the query
	sendQueryParams(conn, command, params)

	// Wait for query to complete and collect results
	return await collectResults(conn)
}

/**
 * Execute a prepared statement asynchronously and return all results
 * @param {PGconn} conn - The connection to use
 * @param {string[]} [params] - Parameters for the prepared statement
 * @param {string} [stmtName=''] - Name of the prepared statement to execute
 * @returns {Promise<PGresult[]>} A Promise that resolves to array of results
 * @throws {Error} When execution fails
 */
export async function queryPrepared(
	conn: PGconn,
	params?: string[],
	stmtName: string = '',
): Promise<PGresult[]> {
	// Send the execution
	sendQueryPrepared(conn, params, stmtName)

	// Wait for query to complete and collect results
	return await collectResults(conn)
}

/**
 * Wait for an async query to complete and collect all results
 * @param {PGconn} conn - The connection to collect results from
 * @returns {Promise<PGresult[]>} A Promise that resolves to array of results
 * @throws {Error} When result collection fails
 */
async function collectResults(conn: PGconn): Promise<PGresult[]> {
	const results: PGresult[] = []

	while (true) {
		// Consume any available input
		consumeInput(conn)

		// Check if connection is still busy
		if (isBusy(conn) === 1) {
			// Still busy, wait and poll again
			await delay(10)
			continue
		}

		// Connection is ready, collect results
		let result: PGresult | null
		while ((result = getResult(conn)) !== null) {
			results.push(result)
		}

		// All results collected
		return results
	}
}

/**
 * Flush connection output asynchronously
 * @param {PGconn} conn - The connection to flush
 * @returns {Promise<void>} A Promise that resolves when flush is complete
 * @throws {Error} When flush fails
 */
export async function flushAsync(conn: PGconn): Promise<void> {
	while (true) {
		const result = flush(conn)

		switch (result) {
			case 0: // All data sent successfully
				return

			case 1: // Some data still queued, try again
				await delay(10)
				break

			default:
				throw new Error(`Unexpected flush result: ${result}`)
		}
	}
}
