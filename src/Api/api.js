const r34_DEFAULT_BASE_URL = 'https://api.rule34.xxx';
const { hasExcludedTagFragment, resolveExcludedTagFragments } = require('../utils/r34TagFilter');

class r34ApiError extends Error {
	constructor(message, context = {}) {
		super(message);
		this.name = 'r34ApiError';
		this.context = context;
	}
}

function normalizeTag(text) {
	return String(text || '')
		.trim()
		.replace(/\s+/g, '_')
		.toLowerCase();
}

function resolveConfig(config = {}) {
	const baseUrl = String(config.baseUrl || process.env.R34_API_BASE_URL || r34_DEFAULT_BASE_URL).trim();
	const userId = String(config.userId || process.env.R34_USER_ID || '').trim();
	const apiKey = String(config.apiKey || process.env.R34_API_KEY || '').trim();

	if (!userId || !apiKey) {
		throw new r34ApiError('Falta configurar r34_USER_ID y r34_API_KEY en .env');
	}

	return { baseUrl, userId, apiKey };
}

function buildSearchUrl({ baseUrl, userId, apiKey, tags, limit = 200, pid = 0 }) {
	const url = new URL('/index.php', baseUrl);
	url.searchParams.set('page', 'dapi');
	url.searchParams.set('s', 'post');
	url.searchParams.set('q', 'index');
	url.searchParams.set('json', '1');
	url.searchParams.set('limit', String(Math.max(1, Math.min(1000, Number(limit) || 200))));
	url.searchParams.set('pid', String(Math.max(0, Number(pid) || 0)));
	url.searchParams.set('tags', tags);
	url.searchParams.set('user_id', userId);
	url.searchParams.set('api_key', apiKey);
	return url.toString();
}

function getPostMediaUrl(post) {
	const candidates = [
		post?.file_url,
		post?.sample_url,
		post?.jpeg_url,
		post?.preview_url,
		post?.source
	];

	return candidates.find((value) => typeof value === 'string' && /^https?:\/\//i.test(value)) || null;
}

function normalizePost(post) {
	const tags = String(post?.tags || '')
		.split(/\s+/)
		.map((item) => item.trim())
		.filter(Boolean);

	return {
		id: Number(post?.id || 0),
		score: Number(post?.score || 0),
		rating: String(post?.rating || 'unknown'),
		tags,
		mediaUrl: getPostMediaUrl(post),
		raw: post
	};
}

async function requestr34(endpointUrl, timeoutMs = 15000) {
	if (typeof fetch !== 'function') {
		throw new r34ApiError('fetch no está disponible. Usa Node.js 18+ o agrega un polyfill.');
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(endpointUrl, {
			method: 'GET',
			headers: { Accept: 'application/json' },
			signal: controller.signal
		});

		const text = await response.text();
		let data = null;

		try {
			data = text ? JSON.parse(text) : null;
		} catch {
			data = text;
		}

		if (!response.ok) {
			throw new r34ApiError(`r34 API respondió ${response.status} ${response.statusText}`, {
				status: response.status,
				statusText: response.statusText,
				data
			});
		}

		return data;
	} catch (error) {
		if (error?.name === 'AbortError') {
			throw new r34ApiError(`Timeout (${timeoutMs}ms) al consultar r34 API`);
		}

		if (error instanceof r34ApiError) {
			throw error;
		}

		throw new r34ApiError(error?.message || 'No se pudo consultar r34 API');
	} finally {
		clearTimeout(timeoutId);
	}
}

async function searchr34Character(characterName, options = {}) {
	const character = normalizeTag(characterName);
	if (!character) {
		throw new r34ApiError('Debes indicar un nombre de personaje.');
	}

	const config = resolveConfig(options);
	const tags = [character, ...(Array.isArray(options.extraTags) ? options.extraTags : [])]
		.map(normalizeTag)
		.filter(Boolean)
		.join(' ');

	const requestUrl = buildSearchUrl({
		...config,
		tags,
		limit: options.limit || 200,
		pid: options.pid || 0
	});

	const data = await requestr34(requestUrl, options.timeoutMs || 15000);

	if (data === false || (data && data.success === false)) {
		const message = String(data?.message || 'La API respondió sin resultados.').trim();
		throw new r34ApiError(message);
	}

	const posts = Array.isArray(data) ? data : Array.isArray(data?.post) ? data.post : [];
	if (posts.length === 0) {
		return null;
	}

	const excludedTagFragments = resolveExcludedTagFragments(options);
	const filteredPosts = posts.filter((post) => !hasExcludedTagFragment(post, excludedTagFragments));
	if (filteredPosts.length === 0) {
		return null;
	}

	const randomPost = filteredPosts[Math.floor(Math.random() * filteredPosts.length)];
	return normalizePost(randomPost);
}

module.exports = {
	searchr34Character,
	r34ApiError
};

