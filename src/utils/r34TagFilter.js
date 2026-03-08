function normalizeTagFragment(text) {
    return String(text || '').trim().toLowerCase();
}

function parseExcludedTags(rawValue) {
    return String(rawValue || '')
        .split(/[\s,;|]+/)
        .map(normalizeTagFragment)
        .filter(Boolean);
}

function resolveExcludedTagFragments(options = {}) {
    const envFragments = parseExcludedTags(process.env.R34_EXCLUDED_TAGS);
    const optionFragments = Array.isArray(options.excludeTagFragments)
        ? options.excludeTagFragments.map(normalizeTagFragment).filter(Boolean)
        : [];

    return [...new Set([...envFragments, ...optionFragments])];
}

function hasExcludedTagFragment(post, excludedFragments = []) {
    if (!Array.isArray(excludedFragments) || excludedFragments.length === 0) {
        return false;
    }

    const normalizedFragments = excludedFragments
        .map(normalizeTagFragment)
        .filter(Boolean);

    if (normalizedFragments.length === 0) {
        return false;
    }

    const rawTags = String(post?.tags || '').toLowerCase();
    if (!rawTags) {
        return false;
    }

    const normalizedTagsText = rawTags.replace(/[^a-z0-9_]+/g, ' ');

    return normalizedFragments.some((fragment) => {
        const normalizedFragment = fragment.replace(/[^a-z0-9_]+/g, '');
        if (!normalizedFragment) {
            return false;
        }

        return rawTags.includes(normalizedFragment) || normalizedTagsText.includes(normalizedFragment);
    });
}

module.exports = {
    resolveExcludedTagFragments,
    hasExcludedTagFragment
};
