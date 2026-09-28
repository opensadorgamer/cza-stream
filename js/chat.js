export function appendChatMessage(container, sender, text, isMe) {
    const div = document.createElement('div');
    div.className = 'flex flex-col ' + (isMe ? 'items-end' : 'items-start') + ' mb-2';
    div.innerHTML = `<span class="text-[10px] text-gray-500 mb-0.5">${escapeHtml(sender)}</span>` +
        `<div class="px-3.5 py-2 rounded-2xl max-w-[85%] break-words text-xs shadow ${isMe ? 'bg-indigo-600 text-white rounded-br-xs' : 'bg-gray-800 text-gray-200 rounded-bl-xs'}">${escapeHtml(text)}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

export function appendSystemMessage(container, text) {
    const div = document.createElement('div');
    div.className = 'text-center text-gray-500 italic my-2 text-[11px]';
    div.innerText = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[tag] || tag));
}
