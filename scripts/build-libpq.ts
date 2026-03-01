#! /usr/bin/env -S deno run --allow-run --allow-read --allow-write

// deno-lint-ignore-file no-console
import { parseArgs } from '@std/cli'
import { existsSync } from '@std/fs'
import { join } from '@std/path'

if (import.meta.main) {
	main()
}

function main() {
	const args = parseArgs(Deno.args, {
		string: ['output'],
		alias: { o: 'output' },
	})
	build(args.output)
}

function build(outName?: string) {
	const arch = Deno.build.arch
	const libPrefix = Deno.build.os === 'windows' ? '' : 'lib'
	const libExt = Deno.build.os === 'windows'
		? 'dll'
		: Deno.build.os === 'darwin'
		? 'dylib'
		: 'so'
	const libName = `${libPrefix}pq.${libExt}`
	const projectDir = join(import.meta.dirname ?? '', '..')
	const postgresDir = join(projectDir, 'postgres')
	const srcDir = join(postgresDir, 'src', 'interfaces', 'libpq')
	const libPath = join(srcDir, libName)
	const distDir = join(projectDir, 'dist')
	const outPath = join(distDir, outName ?? `${libPrefix}pq_${arch}.${libExt}`)

	if (existsSync(outPath)) {
		console.warn(`Output file already exists at ${outPath}, skipping build.`)
		return
	}

	Deno.chdir(postgresDir)

	switch (Deno.build.os) {
		case 'darwin':
		case 'linux': {
			spawnAndWaitSync('./configure', [
				'--without-gssapi',
				'--without-icu',
				'--without-readline',
				'--without-zlib',
			])
			spawnAndWaitSync('make', [
				'-C',
				srcDir,
			])
			break
		}
		case 'windows': {
			throw new Error(
				'Building libpq on Windows is not currently implemented.',
			)
		}
		default:
			throw new Error(`Unsupported platform: ${Deno.build.os}`)
	}

	try {
		Deno.mkdirSync(distDir, { recursive: true })
		Deno.copyFileSync(libPath, outPath)
		console.log(
			`Successfully built libpq for ${Deno.build.os} (${arch}) at ${outPath}`,
		)
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error)
		console.error(`Failed to build libpq: ${msg}`)
		Deno.exit(1)
	}
}

function spawnAndWaitSync(
	cmd: string,
	args: string[],
	options: Deno.CommandOptions = {},
) {
	const process = new Deno.Command(cmd, {
		stdin: 'null',
		stdout: 'inherit',
		stderr: 'inherit',
		args,
		...options,
	})
	const { success, code } = process.outputSync()
	if (!success) {
		throw new Error(
			`Command "${cmd} ${args.join(' ')}" failed with code ${code}`,
		)
	}
}
