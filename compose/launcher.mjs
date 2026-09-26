/**
 * Engine's launcher API for the compose checks, over node:http with no
 * request timeout. Short calls post to /api/launcher; the creation stages run
 * as creation jobs, submitted once and read every two seconds until they
 * settle, so a stage that builds for minutes holds no request open.
 */
import { request as http } from 'node:http';
import { request as https } from 'node:https';

export const STAGES = new Set( [
	'planCity', 'buildCity', 'generateCity', 'generateInstances', 'generateQuests', 'importStory', 'createGame'
] );

export function launcher( base, { pollMs = 2000 } = {} ) {

	const send = ( method, path, body = null ) => new Promise( ( resolve, reject ) => {

		const url = new URL( path, base );
		const payload = body === null ? null : JSON.stringify( body );
		const req = ( url.protocol === 'https:' ? https : http )( url, {
			method, headers: payload === null ? {} : { 'content-type': 'application/json', 'content-length': Buffer.byteLength( payload ) }
		}, ( res ) => {

			const chunks = [];
			res.on( 'data', ( chunk ) => chunks.push( chunk ) );
			res.on( 'end', () => resolve( { status: res.statusCode, headers: res.headers, body: Buffer.concat( chunks ) } ) );
			res.on( 'error', reject );

		} );
		req.on( 'error', reject );
		req.end( payload ?? undefined );

	} );

	const answer = async ( label, response ) => {

		const value = parse( response );
		if ( response.status < 200 || response.status > 299 ) {

			throw new Error( `${label}: HTTP ${response.status} ${value?.code ?? ''} ${value?.message ?? ''}`.trim() );

		}
		return value;

	};

	return {

		/** One launcher method; a creation stage goes through its job. */
		async call( method, input ) {

			if ( STAGES.has( method ) ) return ( await this.stage( method, input ) ).result;
			return answer( method, await send( 'POST', '/api/launcher', { method, ...( input === undefined ? {} : { input } ) } ) );

		},

		/** Runs one creation stage as a job. @returns `{ result, seconds, job }`, seconds from submission to settling */
		async stage( method, input, { onPoll = null } = {} ) {

			const started = performance.now();
			let job = await answer( method, await send( 'POST', '/api/creation-jobs', { method, input } ) );
			while ( job.state === 'queued' || job.state === 'running' ) {

				await new Promise( ( resolve ) => setTimeout( resolve, pollMs ) );
				job = await answer( method, await send( 'GET', `/api/creation-jobs/${job.id}` ) );
				onPoll?.( job, ( performance.now() - started ) / 1000 );

			}
			const seconds = ( performance.now() - started ) / 1000;
			if ( job.state !== 'succeeded' ) throw new Error( `${method} failed after ${seconds.toFixed( 1 )} s: ${job.error?.code} ${job.error?.message}` );
			return { result: job.result, seconds, job };

		},

		/** A served JSON document, refusing the HTML page Vite answers for a missing file. */
		async json( path ) {

			const response = await send( 'GET', path );
			if ( response.status !== 200 || ! isJson( response ) ) throw new Error( `${path}: HTTP ${response.status} ${response.headers[ 'content-type' ] ?? ''}` );
			return JSON.parse( response.body );

		},

		/** Whether a JSON document is served at `path`. */
		async served( path ) {

			const response = await send( 'GET', path );
			return response.status === 200 && isJson( response );

		},

		/** `{ status, type, bytes }` of a HEAD request. */
		async head( path ) {

			const response = await send( 'HEAD', path );
			return { status: response.status, type: response.headers[ 'content-type' ] ?? '', bytes: Number( response.headers[ 'content-length' ] ?? 0 ) };

		}

	};

}

function parse( response ) {

	try { return JSON.parse( response.body ); } catch { return null; }

}

function isJson( response ) {

	return /application\/json/.test( response.headers[ 'content-type' ] ?? '' );

}
