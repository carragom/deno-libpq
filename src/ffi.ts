import { dlopen } from '@denosaurs/plug'

import { DENO_LIBPQ_PATH, DENO_LIBPQ_URL } from './constants.ts'
import meta from '../deno.json' with { type: 'json' }

export interface Libpq {
	PQbackendPID: (conn: Deno.PointerObject) => number
	PQbinaryTuples: (res: Deno.PointerObject) => number
	PQcancel: (
		cancel: Deno.PointerObject,
		errbuf: BufferSource,
		errbufsize: number,
	) => number
	PQclear: (res: Deno.PointerObject) => void
	PQcmdStatus: (res: Deno.PointerObject) => Deno.PointerValue
	PQcmdTuples: (res: Deno.PointerObject) => Deno.PointerValue
	PQconnectdb: (conninfo: BufferSource) => Deno.PointerValue
	PQconnectdbAsync: (
		conninfo: BufferSource,
	) => Promise<Deno.PointerValue>
	PQconnectPoll: (conn: Deno.PointerObject) => number
	PQconnectStart: (conninfo: BufferSource) => Deno.PointerValue
	PQconsumeInput: (conn: Deno.PointerObject) => number
	PQdb: (conn: Deno.PointerObject) => Deno.PointerValue
	PQdescribePrepared: (
		conn: Deno.PointerObject,
		stmt: BufferSource,
	) => Deno.PointerValue
	PQerrorMessage: (conn: Deno.PointerObject) => Deno.PointerValue
	PQescapeIdentifier: (
		conn: Deno.PointerObject,
		str: BufferSource,
		len: bigint,
	) => Deno.PointerValue
	PQescapeLiteral: (
		conn: Deno.PointerObject,
		str: BufferSource,
		len: bigint,
	) => Deno.PointerValue
	PQexec: (
		conn: Deno.PointerObject,
		query: BufferSource,
	) => Deno.PointerValue
	PQexecAsync: (
		conn: Deno.PointerObject,
		query: BufferSource,
	) => Promise<Deno.PointerValue>
	PQexecParams: (
		conn: Deno.PointerObject,
		command: BufferSource,
		nParams: number,
		paramTypes: Deno.PointerValue,
		paramValues: BufferSource | null,
		paramLengths: Deno.PointerValue,
		paramFormats: Deno.PointerValue,
		resultFormat: number,
	) => Deno.PointerValue
	PQexecParamsAsync: (
		conn: Deno.PointerObject,
		command: BufferSource,
		nParams: number,
		paramTypes: Deno.PointerValue,
		paramValues: BufferSource | null,
		paramLengths: Deno.PointerValue,
		paramFormats: Deno.PointerValue,
		resultFormat: number,
	) => Promise<Deno.PointerValue>
	PQexecPrepared: (
		conn: Deno.PointerObject,
		stmtName: BufferSource,
		nParams: number,
		paramValues: BufferSource | null,
		paramLengths: Deno.PointerValue,
		paramFormats: Deno.PointerValue,
		resultFormat: number,
	) => Deno.PointerValue
	PQexecPreparedAsync: (
		conn: Deno.PointerObject,
		stmtName: BufferSource,
		nParams: number,
		paramValues: BufferSource | null,
		paramLengths: Deno.PointerValue,
		paramFormats: Deno.PointerValue,
		resultFormat: number,
	) => Promise<Deno.PointerValue>
	PQfformat: (res: Deno.PointerObject, field_num: number) => number
	PQfinish: (conn: Deno.PointerObject) => void
	PQfinishAsync: (conn: Deno.PointerObject) => Promise<void>
	PQflush: (conn: Deno.PointerObject) => number
	PQfmod: (res: Deno.PointerObject, field_num: number) => number
	PQfname: (
		res: Deno.PointerObject,
		field_num: number,
	) => Deno.PointerValue
	PQfnumber: (
		res: Deno.PointerObject,
		field_name: BufferSource,
	) => number
	PQfreeCancel: (cancel: Deno.PointerObject) => void
	PQfreemem: (ptr: Deno.PointerValue) => void
	PQfsize: (res: Deno.PointerObject, field_num: number) => number
	PQftable: (res: Deno.PointerObject, field_num: number) => number
	PQftablecol: (
		res: Deno.PointerObject,
		field_num: number,
	) => number
	PQftype: (res: Deno.PointerObject, field_num: number) => number
	PQgetCancel: (conn: Deno.PointerObject) => Deno.PointerValue
	PQgetisnull: (
		res: Deno.PointerObject,
		tup_num: number,
		field_num: number,
	) => number
	PQgetlength: (
		res: Deno.PointerObject,
		tup_num: number,
		field_num: number,
	) => number
	PQgetResult: (conn: Deno.PointerObject) => Deno.PointerValue
	PQgetvalue: (
		res: Deno.PointerObject,
		tup_num: number,
		field_num: number,
	) => Deno.PointerValue
	PQhost: (conn: Deno.PointerObject) => Deno.PointerValue
	PQisBusy: (conn: Deno.PointerObject) => number
	PQisnonblocking: (conn: Deno.PointerObject) => number
	PQnfields: (res: Deno.PointerObject) => number
	PQnparams: (res: Deno.PointerObject) => number
	PQnotifies: (conn: Deno.PointerObject) => Deno.PointerValue
	PQoidValue: (res: Deno.PointerObject) => number
	PQoptions: (conn: Deno.PointerObject) => Deno.PointerValue
	PQparameterStatus: (
		conn: Deno.PointerObject,
		paramName: BufferSource,
	) => Deno.PointerValue
	PQparamtype: (
		res: Deno.PointerObject,
		param_num: number,
	) => number
	PQntuples: (res: Deno.PointerObject) => number
	PQprepare: (
		conn: Deno.PointerObject,
		stmtName: BufferSource,
		query: BufferSource,
		nParams: number,
		paramTypes: Deno.PointerValue,
	) => Deno.PointerValue
	PQprepareAsync: (
		conn: Deno.PointerObject,
		stmtName: BufferSource,
		query: BufferSource,
		nParams: number,
		paramTypes: Deno.PointerValue,
	) => Promise<Deno.PointerValue>
	PQprotocolVersion: (conn: Deno.PointerObject) => number
	PQresetPoll: (conn: Deno.PointerObject) => number
	PQresetStart: (conn: Deno.PointerObject) => number
	PQresStatus: (status: number) => Deno.PointerValue
	PQresultErrorMessage: (
		res: Deno.PointerObject,
	) => Deno.PointerValue
	PQresultErrorField: (
		res: Deno.PointerObject,
		fieldcode: number,
	) => Deno.PointerValue
	PQresultStatus: (res: Deno.PointerObject) => number
	PQresultVerboseErrorMessage: (
		res: Deno.PointerObject,
		verbosity: number,
		show_context: number,
	) => Deno.PointerValue
	PQsendPrepare: (
		conn: Deno.PointerObject,
		stmtName: BufferSource,
		query: BufferSource,
		nParams: number,
		paramTypes: Deno.PointerValue,
	) => number
	PQsendQuery: (
		conn: Deno.PointerObject,
		query: BufferSource,
	) => number
	PQsendQueryParams: (
		conn: Deno.PointerObject,
		command: BufferSource,
		nParams: number,
		paramTypes: Deno.PointerValue,
		paramValues: BufferSource | null,
		paramLengths: Deno.PointerValue,
		paramFormats: Deno.PointerValue,
		resultFormat: number,
	) => number
	PQsendQueryPrepared: (
		conn: Deno.PointerObject,
		stmtName: BufferSource,
		nParams: number,
		paramValues: BufferSource | null,
		paramLengths: Deno.PointerValue,
		paramFormats: Deno.PointerValue,
		resultFormat: number,
	) => number
	PQserverVersion: (conn: Deno.PointerObject) => number
	PQsetnonblocking: (
		conn: Deno.PointerObject,
		arg: number,
	) => number
	PQsocket: (conn: Deno.PointerObject) => number
	PQstatus: (conn: Deno.PointerObject) => number
	PQtransactionStatus: (conn: Deno.PointerObject) => number
	PQuser: (conn: Deno.PointerObject) => Deno.PointerValue
	PQping: (conninfo: BufferSource) => number
	PQport: (conn: Deno.PointerObject) => Deno.PointerValue
	PQreset: (conn: Deno.PointerObject) => void
}

const symbols = {
	PQbackendPID: {
		parameters: ['pointer'], // const PGconn *conn
		result: 'i32', // int
	},
	PQbinaryTuples: {
		parameters: ['pointer'], // const PGresult *res
		result: 'i32', // int
	},
	PQcancel: {
		parameters: [
			'pointer', // PGcancel *cancel
			'buffer', // char *errbuf
			'i32', // int errbufsize
		],
		result: 'i32', // int
	},
	PQclear: {
		parameters: ['pointer'], // const PGresult *res
		result: 'void',
	},
	PQcmdStatus: {
		parameters: [
			'pointer', // PGresult *res
		],
		result: 'buffer', // char *
	},
	PQcmdTuples: {
		parameters: ['pointer'], // const PGresult *res
		result: 'buffer', // char *
	},
	PQconnectdb: {
		parameters: [
			'buffer', // const char *conninfo
		],
		result: 'pointer', // PGconn *
	},
	PQconnectdbAsync: {
		parameters: [
			'buffer', // const char *conninfo
		],
		result: 'pointer', // PGconn *
		name: 'PQconnectdb',
		nonblocking: true,
	},
	PQconnectPoll: {
		parameters: [
			'pointer', // PGconn *conn
		],
		result: 'i32', // PostgresPollingStatusType
	},
	PQconnectStart: {
		parameters: [
			'buffer', // const char *conninfo
		],
		result: 'pointer', // PGconn *
	},
	PQconsumeInput: {
		parameters: [
			'pointer', // PGconn *conn
		],
		result: 'i32', // int
	},
	PQdb: {
		parameters: ['pointer'], // const PGconn *conn
		result: 'buffer', // char *
	},
	PQdescribePrepared: {
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *stmt
		],
		result: 'pointer', // PGresult *
	},
	PQerrorMessage: {
		parameters: [
			'pointer', // PGconn *conn
		],
		result: 'buffer', // char *
	},
	PQescapeIdentifier: {
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *str
			'usize', // size_t len
		],
		result: 'pointer', // char * (must be freed with PQfreemem)
	},
	PQescapeLiteral: {
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *str
			'usize', // size_t len
		],
		result: 'pointer', // char * (must be freed with PQfreemem)
	},
	PQexec: {
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *query
		],
		result: 'pointer', /// PGresult *
	},
	PQexecAsync: {
		name: 'PQexec',
		nonblocking: true,
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *query
		],
		result: 'pointer', // PGresult *
	},
	PQexecParams: {
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *command
			'i32', // int nParams
			'pointer', // const Oid *paramTypes
			'buffer', // const char *const *paramValues
			'pointer', // const int *paramLengths
			'pointer', // const int *paramFormats
			'i32', // int resultFormat
		],
		result: 'pointer', // PGresult *
	},
	PQexecParamsAsync: {
		name: 'PQexecParams',
		nonblocking: true,
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *command
			'i32', // int nParams
			'pointer', // const Oid *paramTypes
			'buffer', // const char *const *paramValues
			'pointer', // const int *paramLengths
			'pointer', // const int *paramFormats
			'i32', // int resultFormat
		],
		result: 'pointer', // PGresult *
	},
	PQexecPrepared: {
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *stmtName
			'i32', // int nParams
			'buffer', // const char *const *paramValues
			'pointer', // const int *paramLengths
			'pointer', // const int *paramFormats,
			'i32', //int resultFormat
		],
		result: 'pointer', // PGresult *
	},
	PQexecPreparedAsync: {
		name: 'PQexecPrepared',
		nonblocking: true,
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *stmtName
			'i32', // int nParams
			'buffer', // const char *const *paramValues
			'pointer', // const int *paramLengths
			'pointer', // const int *paramFormats,
			'i32', //int resultFormat
		],
		result: 'pointer', // PGresult *
	},
	PQfformat: {
		parameters: [
			'pointer', // PGresult *res
			'i32', // int field_num
		],
		result: 'i32', // int
	},
	PQfinish: { parameters: ['pointer'], result: 'void' },
	PQfinishAsync: {
		name: 'PQfinish',
		result: 'void',
		nonblocking: true,
		parameters: [
			'pointer',
		],
	},
	PQflush: {
		parameters: [
			'pointer', // PGconn *conn
		],
		result: 'i32', // int
	},
	PQfmod: {
		parameters: [
			'pointer', // const PGresult *res
			'i32', // int field_num
		],
		result: 'i32', // int
	},
	PQfname: {
		parameters: [
			'pointer', // PGresult *res
			'i32', // int field_num
		],
		result: 'buffer', // char *
	},
	PQfnumber: { parameters: ['pointer', 'buffer'], result: 'i32' },
	PQfreeCancel: {
		parameters: ['pointer'], // PGcancel *cancel
		result: 'void',
	},
	PQfreemem: {
		parameters: ['pointer'], // void *ptr
		result: 'void',
	},
	PQfsize: {
		parameters: [
			'pointer', // const PGresult *res
			'i32', // int field_num
		],
		result: 'i32', // int
	},
	PQftable: {
		parameters: [
			'pointer', // const PGresult *res
			'i32', // int field_num
		],
		result: 'u32', // Oid
	},
	PQftablecol: {
		parameters: [
			'pointer', // const PGresult *res
			'i32', // int field_num
		],
		result: 'i32', // int
	},
	PQftype: {
		parameters: [
			'pointer', // PGresult *res
			'i32', // int field_num
		],
		result: 'u32', // Oid
	},
	PQgetCancel: {
		parameters: ['pointer'], // PGconn *conn
		result: 'pointer', // PGcancel *
	},
	PQgetisnull: { parameters: ['pointer', 'i32', 'i32'], result: 'i32' },
	PQgetlength: { parameters: ['pointer', 'i32', 'i32'], result: 'i32' },
	PQgetResult: {
		parameters: [
			'pointer', // PGconn *conn
		],
		result: 'pointer', // PGresult *
	},
	PQgetvalue: { parameters: ['pointer', 'i32', 'i32'], result: 'buffer' },
	PQhost: {
		parameters: ['pointer'], // const PGconn *conn
		result: 'buffer', // char *
	},
	PQisBusy: {
		parameters: [
			'pointer', // PGconn *conn
		],
		result: 'i32', // int
	},
	PQisnonblocking: {
		parameters: [
			'pointer', // PGconn *conn
		],
		result: 'i32', // int
	},
	PQnfields: { parameters: ['pointer'], result: 'i32' },
	PQnparams: {
		parameters: ['pointer'], // const PGresult *res
		result: 'i32', // int
	},
	PQnotifies: {
		parameters: [
			'pointer', // PGconn *conn
		],
		result: 'pointer', // PGnotify *
	},
	PQoidValue: {
		parameters: ['pointer'], // const PGresult *res
		result: 'u32', // Oid
	},
	PQoptions: {
		parameters: ['pointer'], // const PGconn *conn
		result: 'buffer', // char *
	},
	PQparameterStatus: {
		parameters: [
			'pointer', // const PGconn *conn
			'buffer', // const char *paramName
		],
		result: 'buffer', // const char *
	},
	PQparamtype: {
		parameters: [
			'pointer', // const PGresult *res
			'i32', // int param_num
		],
		result: 'u32', // Oid
	},
	PQntuples: { parameters: ['pointer'], result: 'i32' },
	PQprepare: {
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *stmtName
			'buffer', // const char *query
			'i32', // int nParams
			'pointer', // const Oid *paramTypes
		],
		result: 'pointer', // PGresult *
	},
	PQprepareAsync: {
		name: 'PQprepare',
		nonblocking: true,
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *stmtName
			'buffer', // const char *query
			'i32', // int nParams
			'pointer', // const Oid *paramTypes
		],
		result: 'pointer', // PGresult *
	},
	PQprotocolVersion: {
		parameters: ['pointer'], // const PGconn *conn
		result: 'i32', // int
	},
	PQresetPoll: {
		parameters: [
			'pointer', // PGconn *conn
		],
		result: 'i32', // PostgresPollingStatusType
	},
	PQresetStart: {
		parameters: [
			'pointer', // PGconn *conn
		],
		result: 'i32', // int
	},
	PQresStatus: { parameters: ['i32'], result: 'buffer' },
	PQresultErrorMessage: {
		parameters: [
			'pointer', // PGresult *res
		],
		result: 'buffer', // char *
	},
	PQresultErrorField: {
		parameters: [
			'pointer', // const PGresult *res
			'i32', // int fieldcode
		],
		result: 'buffer', // char *
	},
	PQresultStatus: { parameters: ['pointer'], result: 'i32' },
	PQresultVerboseErrorMessage: {
		parameters: [
			'pointer', // PGresult *res
			'i32', // int verbosity
			'i32', // int show_context
		],
		result: 'buffer', // char *
	},
	PQsendPrepare: {
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *stmtName
			'buffer', // const char *query
			'i32', // int nParams
			'pointer', // const Oid *paramTypes
		],
		result: 'i32', // int
	},
	PQsendQuery: {
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *query
		],
		result: 'i32', // int
	},
	PQsendQueryParams: {
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *command
			'i32', // int nParams
			'pointer', // const Oid *paramTypes
			'buffer', // const char *const *paramValues
			'pointer', // const int *paramLengths
			'pointer', // const int *paramFormats
			'i32', // int resultFormat
		],
		result: 'i32', // int
	},
	PQsendQueryPrepared: {
		parameters: [
			'pointer', // PGconn *conn
			'buffer', // const char *stmtName
			'i32', // int nParams
			'buffer', // const char *const *paramValues
			'pointer', // const int *paramLengths
			'pointer', // const int *paramFormats
			'i32', // int resultFormat
		],
		result: 'i32', // int
	},
	PQserverVersion: {
		parameters: [
			'pointer', // PGconn *conn
		],
		result: 'i32', // int
	},
	PQsetnonblocking: {
		parameters: [
			'pointer', // PGconn *conn
			'i32', // int arg
		],
		result: 'i32', // int
	},
	PQsocket: {
		parameters: ['pointer'], // PGconn *conn
		result: 'i32', // int
	},
	PQstatus: { parameters: ['pointer'], result: 'i32' },
	PQtransactionStatus: {
		parameters: ['pointer'], // const PGconn *conn
		result: 'i32', // PGTransactionStatusType
	},
	PQuser: {
		parameters: ['pointer'], // const PGconn *conn
		result: 'buffer', // char *
	},
	PQping: {
		parameters: [
			'buffer', // const char *conninfo
		],
		result: 'i32', // PGPing (enum value)
	},
	PQport: {
		parameters: ['pointer'], // const PGconn *conn
		result: 'buffer', // char *
	},
	PQreset: {
		parameters: [
			'pointer', // PGconn *conn
		],
		result: 'void',
	},
} as const satisfies Deno.ForeignLibraryInterface

export interface Notify {
	relname: string
	bePid: number
	extra: string
}

export type Oid = number
export type PGcancel = Deno.PointerObject
export type PGconn = Deno.PointerObject
export type PGresult = Deno.PointerObject
export type PGnotify = Deno.PointerValue

export enum ExecStatusType {
	PGRES_EMPTY_QUERY, // empty query string was executed
	PGRES_COMMAND_OK, // a query command that doesn't return anything was executed properly by the backend
	PGRES_TUPLES_OK, // a query command that returns tuples was executed properly by the backend, PGresult contains the result tuples
	PGRES_COPY_OUT, // Copy Out data transfer in progress
	PGRES_COPY_IN, // Copy In data transfer in progress
	PGRES_BAD_RESPONSE, // an unexpected response was recv'd from the backend
	PGRES_NONFATAL_ERROR, // notice or warning message
	PGRES_FATAL_ERROR, // query failed
	PGRES_COPY_BOTH, // Copy In/Out data transfer in progress
	PGRES_SINGLE_TUPLE, // single tuple from larger resultset
	PGRES_PIPELINE_SYNC, // pipeline synchronization point
	PGRES_PIPELINE_ABORTED, // Command did't run because of an abort earlier in the pipeline
}

export enum ConnStatusType {
	CONNECTION_OK,
	CONNECTION_BAD,
	CONNECTION_STARTED, // Waiting for connection to be made.
	CONNECTION_MADE, // Connection OK; waiting to send.
	CONNECTION_AWAITING_RESPONSE, // Waiting for a response from the postmaster.
	CONNECTION_AUTH_OK, // Received authentication; waiting for backend startup.
	CONNECTION_SETENV, // This state is no longer used.
	CONNECTION_SSL_STARTUP, // Negotiating SSL.
	CONNECTION_NEEDED, // Internal state: connect() needed
	CONNECTION_CHECK_WRITABLE, // Checking if session is read-write.
	CONNECTION_CONSUME, // Consuming any extra messages.
	CONNECTION_GSS_STARTUP, // Negotiating GSSAPI.
	CONNECTION_CHECK_TARGET, // Checking target server properties.
	CONNECTION_CHECK_STANDBY, // Checking if server is in standby mode.
}

export enum PostgresPollingStatusType {
	PGRES_POLLING_FAILED, // The async operation failed
	PGRES_POLLING_READING, // Async operation waiting for reading
	PGRES_POLLING_WRITING, // Async operation waiting for writing
	PGRES_POLLING_OK, // Async operation completed successfully
	PGRES_POLLING_ACTIVE, // Deprecated, should not appear
}

export enum PGContextVisibility {
	PQSHOW_CONTEXT_NEVER, // never show CONTEXT field
	PQSHOW_CONTEXT_ERRORS, // show CONTEXT for errors only (default)
	PQSHOW_CONTEXT_ALWAYS, // always show CONTEXT field
}

export enum PGVerbosity {
	PQERRORS_TERSE, // single-line error messages
	PQERRORS_DEFAULT, // recommended style
	PQERRORS_VERBOSE, // all the facts, ma'am
	PQERRORS_SQLSTATE, // only error severity and SQLSTATE code
}

export enum PGPing {
	PQPING_OK, // server is accepting connections
	PQPING_REJECT, // server is alive but rejecting connections
	PQPING_NO_RESPONSE, // could not establish connection
	PQPING_NO_ATTEMPT, // connection not attempted (bad params)
}

export enum PGTransactionStatusType {
	PQTRANS_IDLE, // connection idle
	PQTRANS_ACTIVE, // command in progress
	PQTRANS_INTRANS, // idle, within transaction block
	PQTRANS_INERROR, // idle, within failed transaction
	PQTRANS_UNKNOWN, // cannot determine status
}

/**
 * Error field codes for use with PQresultErrorField
 * Based on postgres_ext.h PG_DIAG_* constants
 * Each value corresponds to the ASCII code of a single character
 */
export enum PGDiag {
	SEVERITY = 83, // 'S'
	SEVERITY_NONLOCALIZED = 86, // 'V'
	SQLSTATE = 67, // 'C'
	MESSAGE_PRIMARY = 77, // 'M'
	MESSAGE_DETAIL = 68, // 'D'
	MESSAGE_HINT = 72, // 'H'
	STATEMENT_POSITION = 80, // 'P'
	INTERNAL_POSITION = 112, // 'p'
	INTERNAL_QUERY = 113, // 'q'
	CONTEXT = 87, // 'W'
	SCHEMA_NAME = 115, // 's'
	TABLE_NAME = 116, // 't'
	COLUMN_NAME = 99, // 'c'
	DATATYPE_NAME = 100, // 'd'
	CONSTRAINT_NAME = 110, // 'n'
	SOURCE_FILE = 70, // 'F'
	SOURCE_LINE = 76, // 'L'
	SOURCE_FUNCTION = 82, // 'R'
}

const libCustomPath = Deno.env.get(DENO_LIBPQ_PATH)
let lib: Deno.DynamicLibrary<Deno.ForeignLibraryInterface>

if (libCustomPath === undefined) {
	// If no custom path is provided, attempt to load with plug
	const url = Deno.env.get(DENO_LIBPQ_URL) ??
		`${meta.github}/releases/download/${meta.version}/`
	const suffixes = {
		x86_64: '_x86_64',
		aarch64: '_aarch64',
	} as const

	switch (Deno.build.os) {
		case 'linux':
			// In Linux we have two versions of the library with the following
			// requirements:
			// - OpenSSL1.1 and GLIBC >=2.28
			// - OpenSSL3.0 and GLIBC >=2.34
			// This should cover at least the following Linux distributions:
			// - RHEL 8 (GLIBC 2.28, OpenSSL 1.1)
			// - RHEL 9 (GLIBC 2.34, OpenSSL 3.0)
			// - Ubuntu 20.04 (GLIBC 2.31, OpenSSL 1.1)
			// - Ubuntu 22.04 (GLIBC 2.35, OpenSSL 3.0)
			// - Debian 10 (GLIBC 2.28, OpenSSL 1.1)
			// - Debian 11 (GLIBC 2.31, OpenSSL 1.1)
			// We try to load the OpenSSL3 version first and if that fails we
			// fallback to OpenSSL1.1
			try {
				lib = await dlopen({
					name: 'pq-openssl3',
					url,
					suffixes,
				}, symbols)
			} catch (e3) {
				try {
					lib = await dlopen({
						name: 'pq-openssl11',
						url,
						suffixes,
					}, symbols)
				} catch (e11) {
					throw new Error(
						`Failed to load libpq dynamic library (tried pq-openssl3 then pq-openssl11).`,
						{ cause: { openssl3: e3, openssl11: e11 } },
					)
				}
			}
			break
		default:
			// For other operating systems, we only provide one version of the library
			lib = await dlopen({ url, suffixes }, symbols)
	}
} else {
	// If a custom path is provided, load the library directly from that path
	lib = Deno.dlopen(
		libCustomPath,
		symbols,
	)
}

export const ffi = lib.symbols as unknown as Libpq
