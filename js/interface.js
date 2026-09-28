export function showScreen(screenId) {
    ['auth-screen', 'lobby-screen', 'call-screen'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === screenId) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    });
}

export function showAuthError(msg) {
    const errBox = document.getElementById('auth-error');
    if (errBox) {
        errBox.innerText = msg;
        errBox.classList.remove('hidden');
    }
}

export function showLobbyError(msg) {
    const errBox = document.getElementById('lobby-error');
    if (errBox) {
        errBox.innerText = msg;
        errBox.classList.remove('hidden');
    }
}

export function toggleFullscreen(videoBoxElement) {
    if (!videoBoxElement) return;
    videoBoxElement.classList.toggle('fullscreen');
    const icon = videoBoxElement.querySelector('.fullscreen-btn i');
    if (icon) {
        if (videoBoxElement.classList.contains('fullscreen')) {
            icon.className = "fa-solid fa-compress";
        } else {
            icon.className = "fa-solid fa-expand";
        }
    }
}

let onlineMembers = new Set();

export function updateOnlineMembersList(username, isAdd = true) {
    if (!username) return;
    if (isAdd) {
        onlineMembers.add(username);
    } else {
        onlineMembers.delete(username);
    }

    const listContainer = document.getElementById('online-users-list');
    if (!listContainer) return;

    // Mantém o cabeçalho e reconstrói a lista
    listContainer.innerHTML = '<div class="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-2 py-1">Membros Online</div>';

    onlineMembers.forEach(member => {
        const userDiv = document.createElement('div');
        userDiv.className = 'flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-800/50 transition';
        userDiv.innerHTML = `
            <div class="relative">
                <div class="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                    <i class="fa-solid fa-user text-[10px]"></i>
                </div>
                <div class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[#0e131f]"></div>
            </div>
            <span class="text-xs font-medium text-gray-200 truncate">${escapeHtml(member)}</span>
        `;
        listContainer.appendChild(userDiv);
    });
}

export function resetOnlineMembers(currentUsername) {
    onlineMembers.clear();
    if (currentUsername) {
        onlineMembers.add(currentUsername);
    }
    updateOnlineMembersList();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[tag] || tag));
}
