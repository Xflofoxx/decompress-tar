'use strict';
const fileType = require('file-type');
const isStream = require('is-stream');
const tarStream = require('tar-stream');

module.exports = () => (input, opts) => {
	opts = Object.assign({
		legacyTar: false
	}, opts);

	if (!Buffer.isBuffer(input) && !isStream(input)) {
		return Promise.reject(new TypeError(`Expected a Buffer or Stream, got ${typeof input}`));
	}

	if (Buffer.isBuffer(input)) {
		if ((!fileType(input) && !opts.legacyTar) || (fileType(input) && fileType(input).ext !== 'tar')) {
			return Promise.resolve([]);
		}
	}

	const extract = tarStream.extract();
	const files = [];

	extract.on('entry', (header, stream, cb) => {
		const chunk = [];

		stream.on('data', data => chunk.push(data));
		stream.on('end', () => {
			const file = {
				data: Buffer.concat(chunk),
				mode: header.mode,
				mtime: header.mtime,
				path: header.name,
				type: header.type
			};

			if (header.type === 'symlink' || header.type === 'link') {
				file.linkname = header.linkname;
			}

			files.push(file);
			cb();
		});
	});

	const promise = new Promise((resolve, reject) => {
		extract.on('finish', () => resolve(files));
		extract.on('error', reject);
	});

	extract.then = promise.then.bind(promise);
	extract.catch = promise.catch.bind(promise);

	if (Buffer.isBuffer(input)) {
		extract.end(input);
	} else {
		input.pipe(extract);
	}

	return extract;
};
