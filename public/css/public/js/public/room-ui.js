class RoomUI {
  constructor() {
    this.roomId = '';
    this.roomKey = '';
    this.username = '';
    
    this.whiteboardActive = false;
    this.activeSidebarTab = null;
    this.stagedFile = null;

    this.injectPIPCSS();
  }

  injectPIPCSS() {
    const style = document.createElement('style');
    style.innerHTML = `
      .video-grid-container.pip-row {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        grid-template-columns: none !important;
        grid-auto-rows: none !important;
        height: 130px !important;
        max-height: 130px !important;
        padding: 10px !important;
        gap: 12px !important;
        background: #08090d !important;
        border-bottom: 1px solid var(--border-color) !important;
        align-items: center !important;
        justify-content: flex-start !important;
      }
      .video-grid-container.pip-row .video-card {
        width: 177px !important;
        height: 100px !important;
        min-height: auto !important;
        flex-shrink: 0 !important;
      }
      .video-grid-container.pip-row .stream-placeholder .avatar-large {
        width: 42px !important;
        height: 42px !important;
        font-size: 1.1rem !important;
        margin-bottom: 5px !important;
      }
      .video-grid-container.pip-row .stream-placeholder span {
        font-size: 0.75rem !important;
      }
      .video-grid-container.pip-row .video-overlay-info {
        font-size: 0.75rem !important;
        padding: 2px 8px !important;
        bottom: 6px !important;
        left: 6px !important;
      }
    `;
    document.head.appendChild(style);
  }

  init() {
    this.parseRoomConfig();
  }

  parseRoomConfig() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    
    this.roomId = params.get('room');
    this.roomKey = params.get('key');
    
    this.username = localStorage.getItem('username');
    const token = localStorage.getItem('token');
    
    if (!token || !this.username) {
      alert("Session expired. Sign in to join calls.");
      window.location.href = '/index.html';
      return;
    }

    if (!this.roomId) {
      alert("Invalid Room. Redirecting to Lobby.");
      window.location.href = '/index.html';
      return;
    }

    if (!this.roomKey) {
      const decryptModal = document.getElementById('decrypt-modal');
      decryptModal.classList.remove('hidden');
      
      const decryptForm = document.getElementById('decrypt-room-form');
      decryptForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const keyVal = document.getElementById('modal-room-key').value;
        if (keyVal) {
          this.roomKey = keyVal;
          window.location.hash = `room=${this.roomId}&key=${encodeURIComponent(keyVal)}`;
          decryptModal.classList.add('hidden');
          this.startRoomSession();
        }
      });
    } else {
      this.startRoomSession();
    }
  }

  async startRoomSession() {
    try {
      await window.cryptoHelper.initKey(this.roomKey, this.roomId);
      
      const badge = document.getElementById('room-id-badge');
      badge.querySelector('span').innerText = this.roomId;
      badge.addEventListener('click', () => this.copyRoomInvitationLink());
      
      document.getElementById('local-username').innerText = this.username;
      document.getElementById('local-avatar').innerText = this.username.charAt(0).toUpperCase();
      document.getElementById('p-local-username').innerText = `${this.username} (You)`;
      document.getElementById('p-local-avatar').innerText = this.username.charAt(0).toUpperCase();

      const stream = await window.webrtcManager.initLocalMedia();
      this.setLocalStream(stream, false);

      window.webrtcManager.connectSignaling(this.roomId, this.username);
      window.whiteboard.init(document.getElementById('whiteboard-canvas'));
      this.setupButtonListeners();

      this.showSystemMessage("Encryption active. Established secure peer tunnel.");
    } catch (err) {
      alert("Error initializing conference call: " + err.message);
      window.location.href = '/index.html';
    }
  }

  setupButtonListeners() {
    const btnMic = document.getElementById('btn-toggle-mic');
    const btnCam = document.getElementById('btn-toggle-cam');
    const btnScreen = document.getElementById('btn-toggle-screen');
    const btnWhiteboard = document.getElementById('btn-toggle-whiteboard');
    const btnChat = document.getElementById('btn-toggle-chat');
    const btnParticipants = document.getElementById('btn-toggle-participants');
    const btnLeave = document.getElementById('btn-leave-room');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');

    const chatForm = document.getElementById('chat-form');
    const fileTrigger = document.getElementById('btn-trigger-file');
    const fileInput = document.getElementById('file-input');
    const cancelFile = document.getElementById('btn-cancel-file');

    btnMic.addEventListener('click', () => {
      const active = btnMic.classList.toggle('active');
      btnMic.querySelector('i').className = active ? 'fa-solid fa-microphone' : 'fa-solid fa-microphone-slash';
      btnMic.classList.toggle('active-danger', !active);
      window.webrtcManager.toggleMic(active);
      
      const indicator = document.querySelector('#local-video-card .mic-status-indicator i');
      if (indicator) {
        indicator.className = active ? 'fa-solid fa-microphone unmuted' : 'fa-solid fa-microphone-slash muted';
      }
    });

    btnCam.addEventListener('click', () => {
      const active = btnCam.classList.toggle('active');
      btnCam.querySelector('i').className = active ? 'fa-solid fa-video' : 'fa-solid fa-video-slash';
      btnCam.classList.toggle('active-danger', !active);
      window.webrtcManager.toggleCam(active);
    });

    btnScreen.addEventListener('click', async () => {
      const isSharing = btnScreen.classList.contains('active-teal');
      btnScreen.disabled = true;
      const result = await window.webrtcManager.toggleScreenShare(!isSharing);
      if (result) {
        btnScreen.classList.add('active-teal');
      } else {
        btnScreen.classList.remove('active-teal');
      }
      btnScreen.disabled = false;
    });

    btnWhiteboard.addEventListener('click', () => {
      this.whiteboardActive = !this.whiteboardActive;
      btnWhiteboard.classList.toggle('active', this.whiteboardActive);

      const videoGrid = document.getElementById('video-grid');
      const wbSpace = document.getElementById('whiteboard-space');

      if (this.whiteboardActive) {
        videoGrid.classList.add('pip-row');
        wbSpace.style.display = 'flex';
        setTimeout(() => window.whiteboard.resizeCanvas(), 50);
      } else {
        videoGrid.classList.remove('pip-row');
        wbSpace.style.display = 'none';
      }
    });

    btnChat.addEventListener('click', () => this.toggleSidebar('chat'));
    btnParticipants.addEventListener('click', () => this.toggleSidebar('participants'));
    btnCloseSidebar.addEventListener('click', () => this.closeSidebar());

    btnLeave.addEventListener('click', () => {
      if (confirm("Are you sure you want to leave the call?")) {
        window.webrtcManager.disconnectRoom();
        window.location.href = '/index.html';
      }
    });

    fileTrigger.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 104857600) {
          this.showToast("File exceeds 100MB memory limit.", false);
          fileInput.value = '';
          return;
        }
        this.stagedFile = file;
        const preview = document.getElementById('file-preview');
        document.getElementById('file-preview-name').innerText = file.name;
        document.getElementById('file-preview-size').innerText = `(${this.formatBytes(file.size)})`;
        preview.classList.remove('hidden');
      }
    });

    cancelFile.addEventListener('click', () => this.clearFileStage());

    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inputText = document.getElementById('chat-input-text');
      const text = inputText.value.trim();

      if (this.stagedFile) {
        const file = this.stagedFile;
        this.clearFileStage();
        inputText.value = '';
        await window.webrtcManager.sendFile(file);
      } else if (text) {
        inputText.value = '';
        await window.webrtcManager.sendChatMessage(text);
      }
    });
  }

  resetScreenShareButtonState() {
    const btnScreen = document.getElementById('btn-toggle-screen');
    if (btnScreen) btnScreen.classList.remove('active-teal');
  }

  clearFileStage() {
    this.stagedFile = null;
    document.getElementById('file-input').value = '';
    document.getElementById('file-preview').classList.add('hidden');
  }

  setLocalStream(stream, isScreenShare = false) {
    const videoGrid = document.getElementById('video-grid');
    let localCard = document.getElementById('local-video-card');

    if (!localCard) {
      localCard = document.createElement('div');
      localCard.id = 'local-video-card';
      localCard.className = 'video-card';
      localCard.innerHTML = `
        <video id="local-video" autoplay playsinline></video>
        <div id="local-placeholder" class="stream-placeholder">
          <div class="avatar-large">${this.username.charAt(0).toUpperCase()}</div>
          <span>Camera Off</span>
        </div>
        <div class="video-overlay-info">
          <span class="mic-status-indicator unmuted"><i class="fa-solid fa-microphone"></i></span>
          <span>You</span>
        </div>
      `;
      videoGrid.insertBefore(localCard, videoGrid.firstChild);
    }

    const videoElement = document.getElementById('local-video');
    videoElement.srcObject = stream;
    if (isScreenShare) {
      localCard.classList.add('screen-share');
    } else {
      localCard.classList.remove('screen-share');
    }
  }

  toggleLocalPlaceholder(isVisible) {
    const placeholder = document.getElementById('local-placeholder');
    if (placeholder) {
      placeholder.className = isVisible ? 'stream-placeholder' : 'stream-placeholder hidden';
    }
  }

  addVideoContainer(socketId, username, remoteStream) {
    const videoGrid = document.getElementById('video-grid');
    let peerCard = document.getElementById(`card-${socketId}`);

    if (!peerCard) {
      peerCard = document.createElement('div');
      peerCard.id = `card-${socketId}`;
      peerCard.className = 'video-card';
      peerCard.innerHTML = `
        <video id="video-${socketId}" autoplay playsinline></video>
        <div id="placeholder-${socketId}" class="stream-placeholder">
          <div class="avatar-large">${username.charAt(0).toUpperCase()}</div>
          <span>Camera Off</span>
        </div>
        <div class="video-overlay-info">
          <span class="mic-status-indicator unmuted"><i class="fa-solid fa-microphone"></i></span>
          <span>${username}</span>
        </div>
      `;
      videoGrid.appendChild(peerCard);
    }

    const videoElement = document.getElementById(`video-${socketId}`);
    videoElement.srcObject = remoteStream;

    const videoTrack = remoteStream.getVideoTracks()[0];
    const placeholder = document.getElementById(`placeholder-${socketId}`);
    
    if (videoTrack) {
      placeholder.className = videoTrack.enabled ? 'stream-placeholder hidden' : 'stream-placeholder';
      videoTrack.onmute = () => { placeholder.className = 'stream-placeholder'; };
      videoTrack.onunmute = () => { placeholder.className = 'stream-placeholder hidden'; };
    } else {
      placeholder.className = 'stream-placeholder';
    }

    const audioTrack = remoteStream.getAudioTracks()[0];
    const micIndicator = peerCard.querySelector('.mic-status-indicator i');
    if (audioTrack && micIndicator) {
      audioTrack.onmute = () => { micIndicator.className = 'fa-solid fa-microphone-slash muted'; };
      audioTrack.onunmute = () => { micIndicator.className = 'fa-solid fa-microphone unmuted'; };
    }
  }

  removeVideoContainer(socketId) {
    const peerCard = document.getElementById(`card-${socketId}`);
    if (peerCard) peerCard.remove();
  }

  toggleSidebar(tab) {
    const sidebar = document.getElementById('room-sidebar');
    const titleIcon = document.getElementById('sidebar-title-icon');
    const titleText = document.getElementById('sidebar-title-text');
    
    const chatContent = document.getElementById('sidebar-chat-content');
    const partContent = document.getElementById('sidebar-participants-content');
    
    const btnChat = document.getElementById('btn-toggle-chat');
    const btnParticipants = document.getElementById('btn-toggle-participants');

    if (this.activeSidebarTab === tab) {
      this.closeSidebar();
      return;
    }

    sidebar.classList.remove('collapsed');
    this.activeSidebarTab = tab;

    btnChat.classList.remove('active');
    btnParticipants.classList.remove('active');

    if (tab === 'chat') {
      btnChat.classList.add('active');
      titleIcon.className = 'fa-solid fa-comments';
      titleText.innerText = 'Room Chat';
      chatContent.style.display = 'flex';
      partContent.style.display = 'none';
      this.scrollToBottom();
    } else {
      btnParticipants.classList.add('active');
      titleIcon.className = 'fa-solid fa-users';
      titleText.innerText = 'Participants';
      chatContent.style.display = 'none';
      partContent.style.display = 'block';
      this.updateParticipantsList();
    }
  }

  closeSidebar() {
    const sidebar = document.getElementById('room-sidebar');
    sidebar.classList.add('collapsed');
    
    document.getElementById('btn-toggle-chat').classList.remove('active');
    document.getElementById('btn-toggle-participants').classList.remove('active');
    this.activeSidebarTab = null;
  }

  addChatMessage(sender, message, isSelf = false, isWarning = false) {
    const chatLog = document.getElementById('chat-messages');
    const item = document.createElement('div');
    item.className = isSelf ? 'message-item outgoing' : 'message-item incoming';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    item.innerHTML = `
      <div class="message-meta">${sender} • ${time}</div>
      <div class="message-bubble" style="${isWarning ? 'background: rgba(230,57,70,0.15); border-color: rgba(230,57,70,0.3); color: var(--accent-red);' : ''}">
        ${this.escapeHTML(message)}
      </div>
    `;
    chatLog.appendChild(item);
    this.scrollToBottom();
  }

  showSystemMessage(message) {
    const chatLog = document.getElementById('chat-messages');
    const item = document.createElement('div');
    item.className = 'message-item system';
    item.innerHTML = `<div class="message-bubble">${this.escapeHTML(message)}</div>`;
    chatLog.appendChild(item);
    this.scrollToBottom();
  }

  addFileProgressBubble(filename, size, isOutgoing, sender = '') {
    const chatLog = document.getElementById('chat-messages');
    const item = document.createElement('div');
    item.className = isOutgoing ? 'message-item outgoing' : 'message-item incoming';
    
    const id = `file-progress-${filename.replace(/\s+/g, '-')}`;
    const senderName = isOutgoing ? 'You' : sender;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    item.innerHTML = `
      <div class="message-meta">${senderName} • ${time}</div>
      <div class="message-bubble file-message-content" style="min-width: 200px;">
        <div class="file-message-header">
          <i class="fa-solid fa-file-shield" style="font-size: 1.2rem; color: ${isOutgoing ? 'white' : 'var(--accent-teal)'}"></i>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;" title="${filename}">${filename}</span>
        </div>
        <div class="file-message-size">${this.formatBytes(size)}</div>
        <div id="${id}-container">
          <div class="progress-bar-container">
            <div id="${id}-bar" class="progress-bar-fill ${isOutgoing ? 'encrypting' : ''}"></div>
          </div>
          <span id="${id}-status" style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px; display: block;">
            ${isOutgoing ? 'Encrypting & Sending...' : 'Decrypting & Receiving...'}
          </span>
        </div>
      </div>
    `;
    chatLog.appendChild(item);
    this.scrollToBottom();
  }

  updateFileProgressBar(filename, percent, isOutgoing) {
    const id = `file-progress-${filename.replace(/\s+/g, '-')}`;
    const bar = document.getElementById(`${id}-bar`);
    const status = document.getElementById(`${id}-status`);

    if (bar) bar.style.width = `${percent}%`;
    if (status) {
      status.innerText = isOutgoing 
        ? `Encrypting & Sending... ${percent}%` 
        : `Decrypting & Receiving... ${percent}%`;
    }
  }

  markFileProgressComplete(filename, downloadUrl, isOutgoing, isCorrupted = false) {
    const id = `file-progress-${filename.replace(/\s+/g, '-')}`;
    const container = document.getElementById(`${id}-container`);

    if (container) {
      if (isCorrupted) {
        container.innerHTML = `
          <span style="font-size: 0.75rem; color: var(--accent-red); display: block; margin-top: 6px;">
            <i class="fa-solid fa-triangle-exclamation"></i> Decryption Failed (Key mismatch)
          </span>
        `;
      } else {
        container.innerHTML = isOutgoing 
          ? `<span style="font-size: 0.75rem; color: var(--accent-teal); display: block; margin-top: 6px;"><i class="fa-solid fa-circle-check"></i> Sent successfully</span>`
          : `
            <a href="${downloadUrl}" download="${filename}" class="btn btn-file-download">
              <i class="fa-solid fa-download"></i> Save File
            </a>
          `;
      }
    }
    this.scrollToBottom();
  }

  scrollToBottom() {
    const log = document.getElementById('chat-messages');
    log.scrollTop = log.scrollHeight;
  }

  updateParticipantsList() {
    const list = document.getElementById('peer-participants-list');
    if (!list) return;

    list.innerHTML = '';
    const peers = window.webrtcManager.peers;
    const peerIds = Object.keys(peers);
    
    if (peerIds.length === 0) {
      list.innerHTML = '<div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; padding: 10px;">Waiting for peers to join...</div>';
      return;
    }

    peerIds.forEach(id => {
      const peer = peers[id];
      const item = document.createElement('div');
      item.className = 'participant-item';
      const initials = peer.username ? peer.username.charAt(0).toUpperCase() : 'P';
      const isConnected = peer.chatChannel && peer.chatChannel.readyState === 'open';

      item.innerHTML = `
        <div class="participant-user-info">
          <div class="avatar-circle" style="background: rgba(255,255,255,0.06);">${initials}</div>
          <span class="participant-name">${peer.username}</span>
        </div>
        <span class="participant-role-badge" style="background: ${isConnected ? 'rgba(6,214,160,0.1)' : 'rgba(230,57,70,0.1)'}; color: ${isConnected ? 'var(--accent-teal)' : 'var(--accent-red)'}; border-color: ${isConnected ? 'rgba(6,214,160,0.2)' : 'rgba(230,57,70,0.2)'};">
          ${isConnected ? 'Secure Tunnel' : 'Connecting...'}
        </span>
      `;
      list.appendChild(item);
    });
  }

  copyRoomInvitationLink() {
    const inviteUrl = `${window.location.origin}/room.html#room=${this.roomId}&key=${encodeURIComponent(this.roomKey)}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      this.showToast("Room invitation link copied to clipboard!");
    }).catch(() => {
      navigator.clipboard.writeText(this.roomId);
      this.showToast("Room ID copied to clipboard!");
    });
  }

  showToast(message, isSuccess = true) {
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toast-icon');
    const toastMsg = document.getElementById('toast-message');

    if (!toast) return;

    toastMsg.innerText = message;
    if (isSuccess) {
      toast.style.borderColor = 'var(--accent-teal)';
      toast.style.boxShadow = 'var(--shadow-neon-teal)';
      toastIcon.className = 'fa-solid fa-circle-check';
      toastIcon.style.color = 'var(--accent-teal)';
    } else {
      toast.style.borderColor = 'var(--accent-red)';
      toast.style.boxShadow = '0 0 15px rgba(230, 57, 70, 0.4)';
      toastIcon.className = 'fa-solid fa-circle-exclamation';
      toastIcon.style.color = 'var(--accent-red)';
    }

    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
  }

  escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

window.roomUI = new RoomUI();
document.addEventListener('DOMContentLoaded', () => window.roomUI.init());
