const { MENU_TEXT } = require('../constants/bot');

async function handleMenuCommand({ client, message, lowerText }) {
    if (lowerText !== '.menu' && lowerText !== '#menu') {
        return false;
    }

    await client.sendMessage(message.from, MENU_TEXT, { linkPreview: false });
    return true;
}

module.exports = {
    handleMenuCommand
};
