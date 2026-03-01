import { PGURL } from './constants.ts'

const enc = new TextEncoder()
/* WeakMap to hold references to encoded string arrays to prevent garbage collection */
const TO_STR_ARRAY_MAP = new WeakMap<Uint8Array, Uint8Array[]>()

/**
 * Converts a string into a Uint8Array using UTF-8 encoding
 * @param str The string to encode
 * @returns The encoded string as a Uint8Array
 */
export function encode(str: string): Uint8Array<ArrayBuffer> {
	return enc.encode(str)
}

/**
 * Converts a string into a Uint8Array with a terminator appended using UTF-8 encoding. Useful when interacting
 * with C functions
 * @param str The string to encode
 * @param terminator The terminator to append, defaults to null character
 * @returns The encoded string as a Uint8Array
 */
export function encodeTerminated(
	str: string,
	terminator: string = '\0',
): Uint8Array<ArrayBuffer> {
	return encode(str + terminator)
}

/**
 * Encodes an array of strings into a Uint8Array containing pointers to each encoded string.
 * Each string is null-terminated for C interoperability. The function maintains references
 * to the encoded chunks to prevent garbage collection
 *
 * @param strs - Optional array of strings to encode
 * @returns A Uint8Array containing 64-bit pointers to each encoded string, or null if no strings provided
 * @remarks
 * - Each string is encoded as UTF-8 with a null terminator appended
 * - The returned Uint8Array is an 8-bit view of a BigUint64Array containing the pointers
 * - A WeakMap maintains references to prevent the encoded chunks from being garbage collected
 * - Useful for passing string arrays (char**) to C functions via FFI
 */
export function encodeTerminatedArray(
	strs?: string[] | null,
): Uint8Array<ArrayBuffer> | null {
	if (strs === undefined || strs === null || strs.length === 0) {
		return null
	}

	// Encode strings into Uint8Array appending null byte
	const chunks = strs.map((str) => encodeTerminated(str))
	// Create a 64 bit array to store the pointers to each chunk
	const ptrs = new BigUint64Array(chunks.length)

	// Create a pointer to each chunk and store it in the ptrs array
	for (const [index, chunk] of chunks.entries()) {
		const ptr = Deno.UnsafePointer.of(chunk)
		ptrs[index] = Deno.UnsafePointer.value(ptr)
	}

	// Create an 8 bit view of the ptrs array, this is suppose to be more
	// efficient. Not sure if it's worth it
	const r = new Uint8Array(ptrs.buffer)
	// Maps the ptrs buffer to the chunks to prevent GC from collecting them
	TO_STR_ARRAY_MAP.set(r, chunks)

	// Return the 8 bit view of the ptrs buffer
	return r
}

export interface SemVersion {
	version: string
	major: number
	minor: number
	patch: number
}

/**
 * Retrieves the version of glibc installed on a Linux system by executing the
 * `getconf GNU_LIBC_VERSION` command. Parses the output to extract the major
 * and minor version numbers.
 *
 * @returns A Promise that resolves to a SemVersion object containing the glibc version
 *  or null if the version cannot be determined.
 */
export async function getGlibcVersion(): Promise<SemVersion | null> {
	try {
		const p = await new Deno.Command('getconf', {
			args: ['GNU_LIBC_VERSION'],
			stdout: 'piped',
			stderr: 'null',
		}).output()

		if (!p.success) return null

		const text = new TextDecoder().decode(p.stdout).trim() // e.g. "glibc 2.28"
		const m = text.match(/\bglibc\s+((\d+)\.(\d+))\b/i)
		return m?.[1]
			? {
				version: m[1],
				major: Number.parseInt(m[2]),
				minor: Number.parseInt(m[3]),
				patch: 0,
			}
			: null // version not found in output
	} catch {
		return null // command not found, permission denied, not glibc, etc.
	}
}

export async function getOpenSSLVersion(): Promise<string | null> {
	try {
		const p = await new Deno.Command('openssl', {
			args: ['version'],
			stdout: 'piped',
			stderr: 'null',
		}).output()

		if (!p.success) return null

		const text = new TextDecoder().decode(p.stdout).trim() // e.g. "OpenSSL 1.1.1k  25 Mar 2021"
		const m = text.match(/\bOpenSSL\s+(\d+(?:\.\d+)+[a-z]?)\b/i)
		return m?.[1] ?? null
	} catch {
		return null // command not found, permission denied, etc.
	}
}

const LIBPQ_CONN_KEYWORDS = new Set([
	'host',
	'hostaddr',
	'port',
	'dbname',
	'user',
	'password',
	'passfile',
	'channel_binding',
	'connect_timeout',
	'client_encoding',
	'options',
	'application_name',
	'fallback_application_name',
	'keepalives',
	'keepalives_idle',
	'keepalives_interval',
	'keepalives_count',
	'tcp_user_timeout',
	'sslmode',
	'requiressl',
	'sslcert',
	'sslkey',
	'sslrootcert',
	'sslcrl',
	'sslcrldir',
	'sslsni',
	'requirepeer',
	'ssl_min_protocol_version',
	'ssl_max_protocol_version',
	'gssencmode',
	'krbsrvname',
	'gsslib',
	'replication',
	'target_session_attrs',
	'load_balance_hosts',
])

export function resolveConninfo(
	conninfo?: string | URL | Record<string, string>,
): string {
	if (conninfo === undefined) {
		const pgurl = Deno.env.get(PGURL)
		if (pgurl !== undefined && pgurl.trim() !== '') {
			return conninfoToString(pgurl)
		}

		return ''
	}

	return conninfoToString(conninfo)
}

export function conninfoToString(
	conninfo: string | URL | Record<string, string>,
): string {
	if (conninfo instanceof URL) {
		return conninfoFromUrl(conninfo)
	} else if (typeof conninfo === 'object') {
		return Object.entries(conninfo).map(([k, v]) => formatConninfoPair(k, v))
			.join(' ')
	} else {
		if (
			conninfo.startsWith('postgresql://') ||
			conninfo.startsWith('postgres://')
		) {
			try {
				return conninfoFromUrl(new URL(conninfo))
			} catch {
				return conninfo
			}
		}

		return conninfo
	}
}

export function conninfoFromUrl(url: URL): string {
	const params = conninfoParamsFromUrl(url)

	return Object.entries(params).map(([key, value]) =>
		formatConninfoPair(key, value)
	).join(' ')
}

export function conninfoParamsFromUrl(url: URL): Record<string, string> {
	const params = new Map<string, string>()

	for (const [key, value] of url.searchParams.entries()) {
		if (!LIBPQ_CONN_KEYWORDS.has(key) || value.trim() === '') {
			continue
		}

		params.set(key, value)
	}

	if (url.hostname !== '') {
		params.set('host', url.hostname)
	}

	if (url.port !== '') {
		params.set('port', url.port)
	}

	if (url.username !== '') {
		params.set('user', decodeURIComponent(url.username))
	}

	if (url.password !== '') {
		params.set('password', decodeURIComponent(url.password))
	}

	if (url.pathname.length > 1) {
		params.set('dbname', decodeURIComponent(url.pathname.slice(1)))
	}

	if (!params.has('dbname')) {
		params.set('dbname', 'postgres')
	}

	return Object.fromEntries(params)
}

export function formatConninfoPair(key: string, value: string): string {
	return `${key}=${escapeConninfoValue(value)}`
}

export function escapeConninfoValue(value: string): string {
	if (!/[\s'\\]/.test(value)) {
		return value
	}

	const escaped = value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
	return `'${escaped}'`
}
