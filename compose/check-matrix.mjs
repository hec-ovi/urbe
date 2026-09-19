#!/usr/bin/env node
/**
 * Generation gate: builds cities through the real front doors across seeds,
 * sizes and the parameters a user touches, and reports pass or the exact error
 * per combination with seconds and MB. Unit tests prove promises once; this
 * proves the product still works when a parameter moves.
 *
 * node compose/check-matrix.mjs [--sizes 400,800] [--seeds urbe,rain] [--interiors 0] [--keep]
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const ROOT = resolve( new URL( '..', import.meta.url ).pathname );
const args = Object.fromEntries( process.argv.slice( 2 ).map( ( a, i, all ) => a.startsWith( '--' ) ? [ a.slice( 2 ), all[ i + 1 ]?.startsWith( '--' ) || all[ i + 1 ] === undefined ? true : all[ i + 1 ] ] : [] ).filter( e => e.length ) );
const sizes = String( args.sizes ?? '400,800' ).split( ',' ).map( Number );
const seeds = String( args.seeds ?? 'urbe,rain' ).split( ',' );
const interiors = Number( args.interiors ?? 0 );
const OUT = join( ROOT, 'engine', 'out', 'matrix' );

// Every flag a user can move at the front door, each tried on its own.
const VARIANTS = [
	{ id: 'default', flags: [] },
	{ id: 'no-highways', flags: [ '--no-highways' ] },
	{ id: 'no-subways', flags: [ '--no-subways' ] },
	{ id: 'no-alleys', flags: [ '--no-alleys' ] },
	{ id: 'floors-3', flags: [ '--max-floors', '3' ] },
	{ id: 'floors-40', flags: [ '--max-floors', '40' ] },
];

if ( ! args.keep ) rmSync( OUT, { recursive: true, force: true } );
mkdirSync( OUT, { recursive: true } );

const rows = [];
for ( const seed of seeds ) for ( const size of sizes ) for ( const variant of VARIANTS ) {

	const id = `${seed}-${size}-${variant.id}`;
	const dir = join( OUT, id );
	const blueprint = join( dir, 'blueprint.json' );
	mkdirSync( dir, { recursive: true } );
	const t0 = performance.now();
	const atlas = run( 'atlas', [ 'run', 'generate', '--', '--seed', seed, '--size', String( size ), ...variant.flags, '--out', blueprint ] );
	const row = { id, seed, size, variant: variant.id, atlasSeconds: seconds( t0 ) };
	if ( atlas.status !== 0 ) { rows.push( { ...row, ok: false, stage: 'atlas', error: firstError( atlas ) } ); report( row, rows.at( - 1 ) ); continue; }
	const t1 = performance.now();
	const engine = run( 'engine', [ 'run', 'assemble-city', '--', '--blueprint', blueprint, '--out', join( dir, 'city' ), '--interiors', String( interiors ) ] );
	const ok = engine.status === 0;
	const qa = readQa( join( dir, 'city', 'qa-report.json' ) );
	rows.push( { ...row, ok, stage: ok ? null : 'engine', error: ok ? null : firstError( engine ), engineSeconds: seconds( t1 ),
		buildings: qa?.totals?.passed ?? null, kit: qa?.totals?.kit ?? null, empty: qa?.parcels?.filter( p => p.source === 'empty' ).length ?? null,
		mb: qa?.totals?.bytes ? Math.round( qa.totals.bytes / 1e5 ) / 10 : null } );
	report( row, rows.at( - 1 ) );

}

writeFileSync( join( OUT, 'report.json' ), JSON.stringify( rows, null, 1 ) );
const failed = rows.filter( r => ! r.ok );
// The shared store is swept here and not by the batches, so batches running
// side by side never remove each other's plans; only sets no world names go.
if ( ! failed.length ) spawnSync( 'npm', [ 'run', 'gc' ], { cwd: join( ROOT, 'engine' ), stdio: 'inherit' } );
console.log( `\n${rows.length - failed.length}/${rows.length} combinations pass; report: ${join( OUT, 'report.json' )}` );
for ( const r of failed ) console.log( `  FAIL ${r.id}  ${r.stage}: ${r.error}` );
process.exit( failed.length ? 1 : 0 );

function run( box, npmArgs ) {

	return spawnSync( 'npm', npmArgs, { cwd: join( ROOT, box ), encoding: 'utf8', env: { ...process.env, STREETS_WORKERS: process.env.STREETS_WORKERS ?? '4' }, maxBuffer: 64 * 1024 * 1024 } );

}

function firstError( result ) {

	const text = `${result.stderr}\n${result.stdout}`;
	const line = text.split( '\n' ).find( l => /E_[A-Z_]+|Error|FAIL/.test( l ) ) ?? text.trim().split( '\n' ).at( - 1 );
	return ( line ?? `exit ${result.status}` ).trim().slice( 0, 240 );

}

function readQa( path ) {

	try { return JSON.parse( readFileSync( path, 'utf8' ) ); } catch { return null; }

}

function seconds( since ) { return Math.round( ( performance.now() - since ) / 100 ) / 10; }

function report( row, full ) {

	console.log( full.ok
		? `ok    ${row.id}  atlas ${row.atlasSeconds}s  engine ${full.engineSeconds}s  ${full.buildings} buildings (${full.kit} kit, ${full.empty} empty)  ${full.mb} MB`
		: `FAIL  ${row.id}  ${full.stage}: ${full.error}` );

}
