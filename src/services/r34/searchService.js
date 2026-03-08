const { searchr34Character } = require('../../Api/api');
const {
    isR34RepeatLimitReached
} = require('./history');
const {
    R34_MAX_RETRY_ATTEMPTS
} = require('../../constants/bot');

async function searchCharacterWithoutRepeat(chatId, characterName, maxAttempts = R34_MAX_RETRY_ATTEMPTS) {
    let result = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const candidate = await searchr34Character(characterName);

        if (!candidate) {
            result = null;
            break;
        }

        if (!isR34RepeatLimitReached(chatId, candidate.id)) {
            result = candidate;
            break;
        }
    }

    return result;
}

module.exports = {
    searchCharacterWithoutRepeat
};
