import type { Notify, Oid, PGcancel, PGconn, PGresult } from './ffi.ts'
import {
	ConnStatusType,
	type ExecStatusType,
	ffi,
	type PGContextVisibility,
	type PGDiag,
	type PGPing,
	type PGTransactionStatusType,
	type PGVerbosity,
	type PostgresPollingStatusType,
} from './ffi.ts'
import {
	encode,
	encodeTerminated,
	encodeTerminatedArray,
	resolveConninfo,
} from './utils.ts'

/**
 * Frees the storage associated with a PGresult. Should be called when done with a query result.
 * @param {PGresult} res - The result pointer to clear
 */
export function clear(res: PGresult): void {
	ffi.PQclear(res)
}

/**
 * Get the number of rows affected by the SQL command. WARNING: This function behaves
 * slightly different to its C counterpart. The return type is a number instead of a
 * string and -1 was chosen to represent the empty string.
 * For more information see https://www.postgresql.org/docs/current/libpq-exec.html#LIBPQ-PQCMDTUPLES
 * @param {PGresult} res - The PGResult to work with
 * @returns {number} The number of affected rows or -1 when not applicable (DDL commands, etc.)
 */
export function cmdTuples(res: PGresult): number {
	const b = ffi.PQcmdTuples(res)

	if (b !== null) {
		const r = new Deno.UnsafePointerView(b)
		const v = Number.parseInt(r.getCString())
		if (Number.isNaN(v)) {
			return -1
		} else {
			return v
		}
	} else {
		return -1
	}
}

/**
 * Makes a new connection to the database server
 * @param {string | URL | Record<string,string>} conninfo - The database
 * connection string. If a URL is provided, it will be converted to a string.
 * If an object is provided, it will be converted to the key/value connection
 * string format.
 * See {@link https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING libpq connection string formats}
 * for details on supported formats.
 * @returns {PGconn} A database connection pointer
 * @throws {Error} When connection fails
 */
export function connectdb(
	conninfo?: string | URL | Record<string, string>,
): PGconn {
	conninfo = resolveConninfo(conninfo)
	const conn = ffi.PQconnectdb(encodeTerminated(conninfo))
	if (conn !== null) {
		const status = ffi.PQstatus(conn)

		if (status === ConnStatusType.CONNECTION_OK) {
			return conn
		}
		const msg = errorMessage(conn)
		throw new Error(msg)
	}
	throw new Error('Failed to create connection')
}

/**
 * Makes a new asynchronous connection to the database server
 * @param {string | URL | Record<string,string>} conninfo - The database
 * connection string. If a URL is provided, it will be converted to a string.
 * If an object is provided, it will be converted to the key/value connection
 * string format.
 * See {@link https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING libpq connection string formats}
 * for details on supported formats.
 * @returns {Promise<PGconn>} A Promise that resolves to a database connection pointer
 * @throws {Error} When connection fails
 */
export async function connectdbAsync(
	conninfo?: string | URL | Record<string, string>,
): Promise<PGconn> {
	conninfo = resolveConninfo(conninfo)
	const conn = await ffi.PQconnectdbAsync(
		encodeTerminated(conninfo),
	)
	if (conn !== null) {
		const status = ffi.PQstatus(conn)

		if (status === ConnStatusType.CONNECTION_OK) {
			return conn
		}
		const msg = errorMessage(conn)
		throw new Error(msg)
	}
	throw new Error('Failed to create connection')
}

/**
 * Poll an asynchronous connection for completion
 * @param {PGconn} conn - The connection to poll
 * @returns {PostgresPollingStatusType} Polling status - caller checks for PGRES_POLLING_OK, PGRES_POLLING_FAILED, etc.
 */
export function connectPoll(conn: PGconn): PostgresPollingStatusType {
	return ffi.PQconnectPoll(conn)
}

/**
 * Begin nonblocking connection to the database server
 * @param {string | URL | Record<string,string>} conninfo - The database
 * connection string. If a URL is provided, it will be converted to a string.
 * If an object is provided, it will be converted to the key/value connection
 * string format.
 * See {@link https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING libpq connection string formats}
 * for details on supported formats.
 * @returns {PGconn} Connection pointer for polling (use connectPoll to complete)
 * @throws {Error} When connection start fails
 */
export function connectStart(
	conninfo?: string | URL | Record<string, string>,
): PGconn {
	conninfo = resolveConninfo(conninfo)
	const conn = ffi.PQconnectStart(encodeTerminated(conninfo))

	if (conn !== null) {
		return conn
	} else {
		throw new Error('Failed to start connection')
	}
}

/**
 * Consume input if available on the connection
 * @param {PGconn} conn - The connection to read from
 * @returns {1} Always returns 1 on success
 * @throws {Error} When input consumption fails
 */
export function consumeInput(conn: PGconn): 1 {
	const r = ffi.PQconsumeInput(conn)

	switch (r) {
		case 0: {
			const msg = errorMessage(conn)
			throw new Error(msg)
		}
		default:
			return 1
	}
}
/**
 * Escape an identifier (table name, column name, etc.) for use in SQL.
 * Returns a quoted and escaped identifier.
 * @param {PGconn} conn - The connection to use for encoding info
 * @param {string} str - The identifier to escape
 * @returns {string} The escaped and quoted identifier
 * @throws {Error} When escaping fails
 */
export function escapeIdentifier(conn: PGconn, str: string): string {
	const encoded = encode(str)

	const result = ffi.PQescapeIdentifier(conn, encoded, BigInt(encoded.length))

	if (result !== null) {
		const escaped = new Deno.UnsafePointerView(result).getCString()
		ffi.PQfreemem(result) // Free the libpq-allocated memory
		return escaped
	} else {
		throw new Error(errorMessage(conn))
	}
}

/**
 * Escape a string literal for use in SQL. Returns a quoted and escaped string.
 * The returned memory must be freed, but this is handled automatically.
 * @param {PGconn} conn - The connection to use for encoding info
 * @param {string} str - The string to escape
 * @returns {string} The escaped and quoted string literal
 * @throws {Error} When escaping fails
 */
export function escapeLiteral(conn: PGconn, str: string): string {
	const encoded = encode(str)

	const result = ffi.PQescapeLiteral(conn, encoded, BigInt(encoded.length))

	if (result !== null) {
		const escaped = new Deno.UnsafePointerView(result).getCString()
		ffi.PQfreemem(result) // Free the libpq-allocated memory
		return escaped
	} else {
		throw new Error(errorMessage(conn))
	}
}

/**
 * Get the database name of the connection
 * @param {PGconn} conn - The connection
 * @returns {string} The database name
 */
export function db(conn: PGconn): string {
	const result = ffi.PQdb(conn)
	if (result !== null) {
		return new Deno.UnsafePointerView(result).getCString()
	} else {
		throw new Error('PQdb: Unexpected null value returned from libpq')
	}
}

/**
 * Get the user name of the connection
 * @param {PGconn} conn - The connection
 * @returns {string} The user name
 */
export function user(conn: PGconn): string {
	const result = ffi.PQuser(conn)
	if (result !== null) {
		return new Deno.UnsafePointerView(result).getCString()
	} else {
		throw new Error('PQuser: Unexpected null value returned from libpq')
	}
}

/**
 * Get the server host name of the connection
 * @param {PGconn} conn - The connection
 * @returns {string} The host name
 */
export function host(conn: PGconn): string {
	const result = ffi.PQhost(conn)

	if (result !== null) {
		return new Deno.UnsafePointerView(result).getCString()
	} else {
		throw new Error('PQhost: Unexpected null value returned from libpq')
	}
}

/**
 * Get the port of the connection
 * @param {PGconn} conn - The connection
 * @returns {string} The port number as a string
 */
export function port(conn: PGconn): string {
	const result = ffi.PQport(conn)
	if (result !== null) {
		return new Deno.UnsafePointerView(result).getCString()
	} else {
		throw new Error('PQport: Unexpected null value returned from libpq')
	}
}

/**
 * Get the command-line options passed in the connection request
 * @param {PGconn} conn - The connection
 * @returns {string} The options string
 */
export function options(conn: PGconn): string {
	const result = ffi.PQoptions(conn)
	if (result !== null) {
		return new Deno.UnsafePointerView(result).getCString()
	} else {
		throw new Error('PQoptions: Unexpected null value returned from libpq')
	}
}

/**
 * Get the OID of the inserted row (for INSERT commands with RETURNING oid)
 * @param {PGresult} res - The result set
 * @returns {Oid} The OID of the inserted row, or 0 if not applicable
 */
export function oidValue(res: PGresult): Oid {
	return ffi.PQoidValue(res)
}

/**
 * Get the process ID of the backend server process
 * @param {PGconn} conn - The connection
 * @returns {number} The backend process ID
 */
export function backendPID(conn: PGconn): number {
	return ffi.PQbackendPID(conn)
}

/**
 * Check if all fields in the result are in binary format
 * @param {PGresult} res - The result set
 * @returns {boolean} true if all fields are binary
 */
export function binaryTuples(res: PGresult): boolean {
	return ffi.PQbinaryTuples(res) === 1
}

/**
 * Request cancellation of a query
 * @param {PGcancel} cancel - The cancel handle
 * @returns {void} Throws on error
 * @throws {Error} When cancellation request fails
 */
export function cancel(cancel: PGcancel): void {
	const errbuf = new Uint8Array(256)
	const result = ffi.PQcancel(cancel, errbuf, errbuf.length)

	if (result !== 1) {
		const decoder = new TextDecoder()
		const errMsg = decoder.decode(errbuf).split('\0')[0]
		throw new Error(`Cancel failed: ${errMsg}`)
	}
}

/**
 * Free a cancel structure
 * @param {PGcancel} cancel - The cancel handle to free
 */
export function freeCancel(cancel: PGcancel): void {
	ffi.PQfreeCancel(cancel)
}

/**
 * Create a cancel structure for the given connection
 * @param {PGconn} conn - The connection to create a cancel handle for
 * @returns {PGcancel} Cancel handle, or throws on error
 * @throws {Error} When cancel handle creation fails
 */
export function getCancel(conn: PGconn): PGcancel {
	const cancel = ffi.PQgetCancel(conn)
	if (cancel !== null) {
		return cancel
	} else {
		throw new Error('PQgetCancel: Unexpected null value returned from libpq')
	}
}

/**
 * Get the current in-transaction status of the server
 * @param {PGconn} conn - The connection
 * @returns {PGTransactionStatusType} The transaction status
 */
export function transactionStatus(conn: PGconn): PGTransactionStatusType {
	return ffi.PQtransactionStatus(conn)
}

/**
 * Get the current value of a server parameter
 * @param {PGconn} conn - The connection
 * @param {string} paramName - The name of the parameter to query
 * @returns {string | null} The parameter value, or null if unknown
 */
export function parameterStatus(
	conn: PGconn,
	paramName: string,
): string | null {
	const result = ffi.PQparameterStatus(conn, encodeTerminated(paramName))
	return result !== null
		? new Deno.UnsafePointerView(result).getCString()
		: null
}

/**
 * Get the data type OID of a parameter in a prepared statement
 * @param {PGresult} res - The result from PQdescribePrepared
 * @param {number} paramNumber - The parameter number (0-based)
 * @returns {Oid} The OID of the parameter's data type
 */
export function paramtype(res: PGresult, paramNumber: number): Oid {
	return ffi.PQparamtype(res, paramNumber)
}

/**
 * Get the protocol version being used by the connection
 * @param {PGconn} conn - The connection
 * @returns {number} The protocol version (typically 3)
 */
export function protocolVersion(conn: PGconn): number {
	return ffi.PQprotocolVersion(conn)
}

/**
 * Submits a command to the server and waits for the result
 * @param {PGconn} conn - The connection to work on
 * @param {string} command - The SQL command to submit to the server
 * @returns {PGresult} PGResult pointer containing query results
 * @throws {Error} When query execution fails
 */
export function exec(conn: PGconn, command: string): PGresult {
	const r = ffi.PQexec(conn, encodeTerminated(command))

	if (r !== null) {
		return r
	} else {
		const msg = errorMessage(conn)
		throw new Error(msg)
	}
}

/**
 * Submits a command to the server asynchronously and waits for the result
 * @param {PGconn} conn - The connection to work on
 * @param {string} command - The SQL command to submit to the server
 * @returns {Promise<PGresult>} Promise that resolves to PGResult pointer containing query results
 * @throws {Error} When query execution fails (connection-level errors only)
 */
export async function execAsync(
	conn: PGconn,
	command: string,
): Promise<PGresult> {
	const r = await ffi.PQexecAsync(conn, encodeTerminated(command))

	if (r !== null) {
		return r
	} else {
		const msg = errorMessage(conn)
		throw new Error(msg)
	}
}

/**
 * Submits a parameterized command to the server and waits for the result
 * @param {PGconn} conn - The connection to work on
 * @param {string} command - The SQL command to submit to the server
 * @param {string[]} [params] - Parameters for the query
 * @returns {PGresult} PGResult pointer containing query results
 * @throws {Error} When query execution fails
 */
export function execParams(
	conn: PGconn,
	command: string,
	params?: string[],
): PGresult {
	let nParams: number
	let paramValues: Uint8Array<ArrayBuffer> | null

	if (params === undefined) {
		nParams = 0
		paramValues = null
	} else {
		nParams = params.length
		paramValues = encodeTerminatedArray(params)
	}

	const r = ffi.PQexecParams(
		conn,
		encodeTerminated(command),
		nParams,
		null, // paramTypes
		paramValues,
		null, // paramLengths
		null, // paramFormats
		0, // resultFormat
	)

	if (r !== null) {
		return r
	} else {
		const msg = errorMessage(conn)
		throw new Error(msg)
	}
}

/**
 * Submits a parameterized command to the server asynchronously and waits for the result
 * @param {PGconn} conn - The connection to work on
 * @param {string} command - The SQL command to submit to the server
 * @param {string[]} [params] - Parameters for the query
 * @returns {Promise<PGresult>} Promise that resolves to PGResult pointer containing query results
 * @throws {Error} When query execution fails (connection-level errors only)
 */
export async function execParamsAsync(
	conn: PGconn,
	command: string,
	params?: string[],
): Promise<PGresult> {
	let nParams: number
	let paramValues: Uint8Array<ArrayBuffer> | null

	if (params === undefined) {
		nParams = 0
		paramValues = null
	} else {
		nParams = params.length
		paramValues = encodeTerminatedArray(params)
	}

	const r = await ffi.PQexecParamsAsync(
		conn,
		encodeTerminated(command),
		nParams,
		null, // paramTypes
		paramValues,
		null, // paramLengths
		null, // paramFormats
		0, // resultFormat
	)

	if (r !== null) {
		return r
	} else {
		const msg = errorMessage(conn)
		throw new Error(msg)
	}
}

/**
 * Execute a prepared statement with given parameters
 * @param {PGconn} conn - The connection to work on
 * @param {string[]} [params] - Parameters for the prepared statement
 * @param {string} [stmtName=''] - Name of the prepared statement to execute
 * @returns {PGresult} PGResult pointer containing query results
 * @throws {Error} When statement execution fails
 */
export function execPrepared(
	conn: PGconn,
	params?: string[],
	stmtName: string = '',
): PGresult {
	let nParams: number
	let paramValues: Uint8Array<ArrayBuffer> | null

	if (params === undefined) {
		nParams = 0
		paramValues = null
	} else {
		nParams = params.length
		paramValues = encodeTerminatedArray(params)
	}
	const name = encodeTerminated(stmtName)

	const r = ffi.PQexecPrepared(
		conn,
		name,
		nParams,
		paramValues,
		null,
		null,
		0,
	)

	if (r !== null) {
		return r
	} else {
		const msg = errorMessage(conn)
		throw new Error(msg)
	}
}

/**
 * Execute a prepared statement asynchronously with given parameters
 * @param {PGconn} conn - The connection to work on
 * @param {string[]} [params] - Parameters for the prepared statement
 * @param {string} [stmtName=''] - Name of the prepared statement to execute
 * @returns {Promise<PGresult>} Promise that resolves to PGResult pointer containing query results
 * @throws {Error} When statement execution fails (connection-level errors only)
 */
export async function execPreparedAsync(
	conn: PGconn,
	params?: string[],
	stmtName: string = '',
): Promise<PGresult> {
	let nParams: number
	let paramValues: Uint8Array<ArrayBuffer> | null

	if (params === undefined) {
		nParams = 0
		paramValues = null
	} else {
		nParams = params.length
		paramValues = encodeTerminatedArray(params)
	}
	const name = encodeTerminated(stmtName)

	const r = await ffi.PQexecPreparedAsync(
		conn,
		name,
		nParams,
		paramValues,
		null,
		null,
		0,
	)

	if (r !== null) {
		return r
	} else {
		const msg = errorMessage(conn)
		throw new Error(msg)
	}
}

/**
 * Get the type-specific modifier for the field
 * @param {PGresult} res - The result set
 * @param {number} columnNumber - The column number (0-based)
 * @returns {number} The type modifier (-1 if no information is available, this is normal for most data types)
 */
export function fmod(res: PGresult, columnNumber: number): number {
	return ffi.PQfmod(res, columnNumber)
}

/**
 * Get the size in bytes of the field type (negative value for variable-length types)
 * @param {PGresult} res - The result set
 * @param {number} columnNumber - The column number (0-based)
 * @returns {number} The field size in bytes
 */
export function fsize(res: PGresult, columnNumber: number): number {
	return ffi.PQfsize(res, columnNumber)
}

/**
 * Get the OID of the table from which the given field was fetched
 * @param {PGresult} res - The result set
 * @param {number} columnNumber - The column number (0-based)
 * @returns {Oid} The table OID, or 0 if columnNumber is out of range or not a simple reference
 */
export function ftable(res: PGresult, columnNumber: number): Oid {
	return ffi.PQftable(res, columnNumber)
}

/**
 * Get the column number within the source table for the given field
 * @param {PGresult} res - The result set
 * @param {number} columnNumber - The column number (0-based)
 * @returns {number} The column number (1-based), or 0 if columnNumber is out of range or not a simple reference
 */
export function ftablecol(res: PGresult, columnNumber: number): number {
	return ffi.PQftablecol(res, columnNumber)
}

/**
 * Returns the format code indicating the format of the given column
 * @param {PGresult} res - The result set to examine
 * @param {number} columnNumber - The column number (0-based)
 * @returns {number} Format code indicating the format of the given column: 0 for text format, 1 for binary format. Other values are reserved for future use.
 */
export function fformat(res: PGresult, columnNumber: number): number {
	return ffi.PQfformat(res, columnNumber)
}

/**
 * Get the field type OID for a given field
 * @param {PGresult} res - The result set
 * @param {number} columnNumber - The column number (0-based)
 * @returns {Oid} The OID of the field's data type
 */
export function ftype(res: PGresult, columnNumber: number): Oid {
	return ffi.PQftype(res, columnNumber)
}

/**
 * Close the connection to the server and free the PGconn data structure
 * @param {PGconn} conn - The connection to close
 */
export function finish(conn: PGconn): void {
	ffi.PQfinish(conn)
}

/**
 * Force-flush any queued output data to the server
 * @param {PGconn} conn - The connection to flush
 * @returns {number} 1 if unable to send all data yet, or throws on error
 * @throws {Error} When flush fails
 */
export function flush(conn: PGconn): number {
	const result = ffi.PQflush(conn)
	if (result === -1) {
		throw new Error(errorMessage(conn))
	}
	return result
}

/**
 * Returns the column name associated with the given column number
 * @param {PGresult} res - The result set to examine
 * @param {number} columnNumber - The column number (0-based)
 * @returns {string} The column name
 * @throws {Error} When column number is invalid or result is null
 */
export function fname(res: PGresult, columnNumber: number): string {
	const r = ffi.PQfname(res, columnNumber)
	if (r !== null) {
		return new Deno.UnsafePointerView(r).getCString()
	} else {
		throw new Error('PQfname: Unexpected null value returned from database')
	}
}

/**
 * Returns the column number associated with the given column name
 * @param {PGresult} res - The result set to examine
 * @param {string} columnName - The column name to look up
 * @returns {number} The column number (0-based) or -1 if not found
 */
export function fnumber(res: PGresult, columnName: string): number {
	const column = encodeTerminated(columnName)
	return ffi.PQfnumber(res, column)
}

/**
 * Tests a field for a null value. Row and column numbers start at 0.
 * @param {PGresult} res - The PGResult to work with
 * @param {number} rowNumber - The row number (0-based)
 * @param {number} columnNumber - The column number (0-based)
 * @returns {boolean} true when field is null, false otherwise
 */
export function getisnull(
	res: PGresult,
	rowNumber: number,
	columnNumber: number,
): boolean {
	const r = ffi.PQgetisnull(res, rowNumber, columnNumber)

	return r === 0 ? false : true
}

/**
 * Consume all available results on an asynchronous connection
 * See: https://www.postgresql.org/docs/current/libpq-async.html#LIBPQ-PQGETRESULT
 * @param {PGconn} conn - The connection to get results from
 * @returns {PGresult | null} Next result or null when no more results
 */
export function getResult(conn: PGconn): PGresult | null {
	return ffi.PQgetResult(conn)
}

/**
 * Returns a single field value of one row of a PGresult. Row and column
 * numbers start at 0.
 * @param {PGresult} res - The PGResult to work with
 * @param {number} rowNumber - The row number (0-based)
 * @param {number} columnNumber - The column number (0-based)
 * @returns {string | ArrayBuffer | null} String for text values, ArrayBuffer for binary values, null for NULL values
 * @throws {Error} When field access fails
 */
export function getvalue(
	res: PGresult,
	rowNumber: number,
	columnNumber: number,
): string | ArrayBuffer | null {
	if (getisnull(res, rowNumber, columnNumber)) {
		return null
	}

	const r = ffi.PQgetvalue(res, rowNumber, columnNumber)
	if (r !== null) {
		const view = new Deno.UnsafePointerView(r)
		const format = fformat(res, columnNumber)

		switch (format) {
			case 0:
				return view.getCString()
			case 1: {
				const length = ffi.PQgetlength(res, rowNumber, columnNumber)
				return view.getArrayBuffer(length)
			}
			default: {
				throw new Error(
					`PQgetvalue: Unknown format value ${format} returned from database`,
				)
			}
		}
	} else {
		throw new Error(
			'PQgetvalue: Unexpected null value returned from database',
		)
	}
}

/**
 * Test whether a command is busy (would getResult block?)
 * @param {PGconn} conn - The connection to test
 * @returns {number} 1 if busy (would block), 0 if ready
 */
export function isBusy(conn: PGconn): number {
	return ffi.PQisBusy(conn)
}

/**
 * Test the nonblocking status of the connection
 * @param {PGconn} conn - The connection to test
 * @returns {number} 1 if nonblocking, 0 if blocking
 */
export function isnonblocking(conn: PGconn): number {
	return ffi.PQisnonblocking(conn)
}

/**
 * Extract the number of fields (columns) from a PGResult
 * @param {PGresult} res - PGResult pointer
 * @returns {number} The number of fields (columns) in the query result
 */
export function nfields(res: PGresult): number {
	return ffi.PQnfields(res)
}

/**
 * Get the number of parameters in a prepared statement result
 * @param {PGresult} res - The result from PQdescribePrepared
 * @returns {number} The number of parameters
 */
export function nparams(res: PGresult): number {
	return ffi.PQnparams(res)
}

/**
 * Submit a request to obtain information about a prepared statement
 * @param {PGconn} conn - The connection to work on
 * @param {string} [stmtName=''] - Name of the prepared statement to describe
 * @returns {PGresult} PGResult pointer containing statement metadata
 * @throws {Error} When the describe request fails at connection level
 */
export function describePrepared(
	conn: PGconn,
	stmtName: string = '',
): PGresult {
	const res = ffi.PQdescribePrepared(conn, encodeTerminated(stmtName))

	if (res !== null) {
		return res
	} else {
		const msg = errorMessage(conn)
		throw new Error(msg)
	}
}

/**
 * Extract the number of rows (tuples) from a PGResult
 * @param {PGresult} res - PGResult pointer
 * @returns {number} The number of rows (tuples) in the query result
 */
export function ntuples(res: PGresult): number {
	return ffi.PQntuples(res)
}

/**
 * Prepares a statement for execution
 * @param {PGconn} conn - The connection to prepare the statement on
 * @param {string} query - The SQL query to prepare
 * @param {string} [stmtName=''] - The name to assign to the prepared statement. If empty, creates an unnamed statement
 * @returns {PGresult} The result of the preparation
 * @throws {Error} When statement preparation fails
 */
export function prepare(
	conn: PGconn,
	query: string,
	stmtName: string = '',
): PGresult {
	const res = ffi.PQprepare(
		conn,
		encodeTerminated(stmtName),
		encodeTerminated(query),
		0,
		null,
	)

	if (res !== null) {
		return res
	} else {
		const msg = errorMessage(conn)
		throw new Error(msg)
	}
}

/**
 * Prepares a statement for execution asynchronously
 * @param {PGconn} conn - The connection to prepare the statement on
 * @param {string} query - The SQL query to prepare
 * @param {string} [stmtName=''] - The name to assign to the prepared statement. If empty, creates an unnamed statement
 * @returns {Promise<PGresult>} Promise that resolves to the result of the preparation
 * @throws {Error} When statement preparation fails (connection-level errors only)
 */
export async function prepareAsync(
	conn: PGconn,
	query: string,
	stmtName: string = '',
): Promise<PGresult> {
	const res = await ffi.PQprepareAsync(
		conn,
		encodeTerminated(stmtName),
		encodeTerminated(query),
		0,
		null,
	)

	if (res !== null) {
		return res
	} else {
		const msg = errorMessage(conn)
		throw new Error(msg)
	}
}

/**
 * Poll an asynchronous connection reset for completion
 * @param {PGconn} conn - The connection being reset
 * @returns {PostgresPollingStatusType} Polling status - caller handles different states
 */
export function resetPoll(conn: PGconn): PostgresPollingStatusType {
	return ffi.PQresetPoll(conn)
}

/**
 * Begin nonblocking connection reset
 * @param {PGconn} conn - The connection to reset
 * @returns {void} Throws on failure
 */
export function resetStart(conn: PGconn): void {
	const result = ffi.PQresetStart(conn)
	if (result === 0) {
		throw new Error(errorMessage(conn))
	}
}

/**
 * Converts the enumerated type returned by resultStatus into a string
 * constant describing the status code
 * @param {ExecStatusType} status - The status code to convert
 * @returns {string} The status code as a string
 * @throws {Error} When status conversion fails
 */
export function resStatus(status: ExecStatusType): string {
	const s = ffi.PQresStatus(status)

	if (s !== null) {
		const r = new Deno.UnsafePointerView(s)
		return r.getCString()
	} else {
		throw new Error(
			'PQresStatus: Unexpected null value returned from database',
		)
	}
}

/**
 * Get the error message associated with a result
 * @param {PGresult} res - The result to get the error message from
 * @returns {string} The error message, or empty string if no error
 */
export function resultErrorMessage(res: PGresult): string {
	const err = ffi.PQresultErrorMessage(res)

	if (err !== null) {
		const msg = new Deno.UnsafePointerView(err).getCString()
		return msg
	} else {
		return ''
	}
}

/**
 * Get a specific error field from a result
 * @param {PGresult} res - The result to get the error field from
 * @param {PGDiag} fieldcode - The error field code (use PGDiag enum)
 * @returns {string | null} The error field value, or null if not available
 */
export function resultErrorField(
	res: PGresult,
	fieldcode: PGDiag,
): string | null {
	const field = ffi.PQresultErrorField(res, fieldcode)

	return field !== null ? new Deno.UnsafePointerView(field).getCString() : null
}

/**
 * Get the execution status of a PGResult
 * @param {PGresult} res - The PGResult to get the status from
 * @returns {ExecStatusType} The status of the result
 */
export function resultStatus(res: PGresult): ExecStatusType {
	return ffi.PQresultStatus(res)
}

/**
 * Get a verbose error message associated with a result
 * @param {PGresult} res - The result to get the error message from
 * @param {PGVerbosity} verbosity - The verbosity level of the error message
 * @param {PGContextVisibility} showContext - Whether to show context information
 * @returns {string | null} The verbose error message, or null if no error. Memory is automatically freed.
 */
export function resultVerboseErrorMessage(
	res: PGresult,
	verbosity: PGVerbosity,
	showContext: PGContextVisibility,
): string | null {
	const err = ffi.PQresultVerboseErrorMessage(res, verbosity, showContext)

	if (err !== null) {
		const msg = new Deno.UnsafePointerView(err).getCString()
		ffi.PQfreemem(err)
		return msg
	} else {
		return null
	}
}

/**
 * Send a prepare command to the server without waiting for the result
 * @param {PGconn} conn - The connection to use
 * @param {string} query - The SQL query to prepare
 * @param {string} [stmtName=''] - The name to assign to the prepared statement
 * @returns {void} Throws on error
 * @throws {Error} When sending the prepare fails
 */
export function sendPrepare(
	conn: PGconn,
	query: string,
	stmtName: string = '',
): void {
	const result = ffi.PQsendPrepare(
		conn,
		encodeTerminated(stmtName),
		encodeTerminated(query),
		0, // nParams
		null, // paramTypes
	)

	if (result === 0) {
		throw new Error(errorMessage(conn))
	}
}

/**
 * Send a query command to the server without waiting for the result
 * @param {PGconn} conn - The connection to use
 * @param {string} command - The SQL command to send
 * @returns {void} Throws on error
 * @throws {Error} When sending the query fails
 */
export function sendQuery(conn: PGconn, command: string): void {
	const result = ffi.PQsendQuery(conn, encodeTerminated(command))
	if (result === 0) {
		throw new Error(errorMessage(conn))
	}
}

/**
 * Send a parameterized query command to the server without waiting for the result
 * @param {PGconn} conn - The connection to use
 * @param {string} command - The SQL command to send
 * @param {string[]} [params] - Parameters for the query
 * @returns {void} Throws on error
 * @throws {Error} When sending the query fails
 */
export function sendQueryParams(
	conn: PGconn,
	command: string,
	params?: string[],
): void {
	let nParams: number
	let paramValues: Uint8Array<ArrayBuffer> | null

	if (params === undefined) {
		nParams = 0
		paramValues = null
	} else {
		nParams = params.length
		paramValues = encodeTerminatedArray(params)
	}

	const result = ffi.PQsendQueryParams(
		conn,
		encodeTerminated(command),
		nParams,
		null, // paramTypes
		paramValues,
		null, // paramLengths
		null, // paramFormats
		0, // resultFormat
	)

	if (result === 0) {
		throw new Error(errorMessage(conn))
	}
}

/**
 * Send execution of a prepared statement without waiting for the result
 * @param {PGconn} conn - The connection to use
 * @param {string[]} [params] - Parameters for the prepared statement
 * @param {string} [stmtName=''] - Name of the prepared statement to execute
 * @returns {void} Throws on error
 * @throws {Error} When sending the execution fails
 */
export function sendQueryPrepared(
	conn: PGconn,
	params?: string[],
	stmtName: string = '',
): void {
	let nParams: number
	let paramValues: Uint8Array<ArrayBuffer> | null

	if (params === undefined) {
		nParams = 0
		paramValues = null
	} else {
		nParams = params.length
		paramValues = encodeTerminatedArray(params)
	}

	const result = ffi.PQsendQueryPrepared(
		conn,
		encodeTerminated(stmtName),
		nParams,
		paramValues,
		null, // paramLengths
		null, // paramFormats
		0, // resultFormat
	)

	if (result === 0) {
		throw new Error(errorMessage(conn))
	}
}

/**
 * Get the status of the connection
 * @param {PGconn} conn - The connection to get the status from
 * @returns {ConnStatusType} The status of the connection
 */
export function status(conn: PGconn): ConnStatusType {
	return ffi.PQstatus(conn)
}

/**
 * Test server connectivity using connection string
 * @param {string | URL | Record<string,string>} conninfo - Connection parameters
 * @returns {PGPing} Status indicating server availability
 */
export function ping(
	conninfo?: string | URL | Record<string, string>,
): PGPing {
	conninfo = resolveConninfo(conninfo)
	return ffi.PQping(encodeTerminated(conninfo))
}

/**
 * Reset the connection to the server synchronously
 * @param {PGconn} conn - The connection to reset
 */
export function reset(conn: PGconn): void {
	ffi.PQreset(conn)
}

/**
 * Check for pending notifications from the server
 * @param {PGconn} conn - The connection to check for notifications
 * @returns {Notify | null} The next notification or null if none available
 */
export function notifies(conn: PGconn): Notify | null {
	const pgNotify = ffi.PQnotifies(conn)

	if (pgNotify !== null) {
		const view = new Deno.UnsafePointerView(pgNotify!)
		const relname = new Deno.UnsafePointerView(view.getPointer()!)
			.getCString()
		const bePid = view.getInt32(8)
		// Memory will be aligned to 8 bytes
		const extra = new Deno.UnsafePointerView(view.getPointer(16)!)
			.getCString()

		// Free the PGnotify structure
		ffi.PQfreemem(pgNotify)

		return { relname, bePid, extra }
	} else {
		return null
	}
}

/**
 * Get the error message from the connection
 * @param {PGconn} conn - The connection to get the error message from
 * @returns {string} The error message
 * @throws {Error} When no error message is available
 */
function errorMessage(conn: PGconn): string {
	const err = ffi.PQerrorMessage(conn)

	if (err !== null) {
		const msg = new Deno.UnsafePointerView(err).getCString()
		return msg
	} else {
		throw new Error('No error message available in the connection')
	}
}
