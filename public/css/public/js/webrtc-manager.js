class WebRTCManager {
  constructor() {
    this.localStream = null;
    this.screenStream = null;
    this.peers = {}; // { socketId: { pc, chatChannel, whiteboardChannel, username } }
    this.socket = null;
    this.roomId = '';
    this.username = '';
    
    this.iceConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    this.fileTransfers = {};
  }

  async initLocalMedia() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: true
      });
      return this.localStream;
    } catch (err) {
      console.warn("Camera init failed, trying fallback audio only", err);
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        return this.localStream;
      } catch (audioErr) {
        throw new Error("Unable to acquire local voice or camera tracks.");
      }
    }
  }

  connectSignaling(roomId, username) {
    this.roomId = roomId;
    this.username = username;
    this.socket = io();

    this.socket.on('connect', () => {
      this.socket.emit('join-room', { roomId: this.roomId, username: this.username });
    });

    this.socket.on('room-users', (users) => {
      users.forEach(user => {
        this.createPeerConnection(user.socketId, user.username, true);
      });
      window.roomUI.updateParticipantsList();
    });

    this.socket.on('user-joined', ({ socketId, username }) => {
      window.roomUI.showSystemMessage(`${username} joined the room.`);
      this.peers[socketId] = { username };
      window.roomUI.updateParticipantsList();
    });

    this.socket.on('sdp-offer', async ({ senderSocketId, offer }) => {
      await this.handleOffer(senderSocketId, offer);
    });

    this.socket.on('sdp-answer', async ({ senderSocketId, answer }) => {
      await this.handleAnswer(senderSocketId, answer);
    });

    this.socket.on('ice-candidate', async ({ senderSocketId, candidate }) => {
      await this.handleIceCandidate(senderSocketId, candidate);
    });

    this.socket.on('user-left', ({ socketId, username }) => {
      window.roomUI.showSystemMessage(`${username} left the room.`);
      this.closePeer(socketId);
    });
  }

  async createPeerConnection(targetSocketId, username, isInitiator) {
    const pc = new RTCPeerConnection(this.iceConfig);
    
    this.peers[targetSocketId] = {
      pc: pc,
      username: username,
      chatChannel: null,
      whiteboardChannel: null
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      window.roomUI.addVideoContainer(targetSocketId, username, remoteStream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          targetSocketId: targetSocketId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.closePeer(targetSocketId);
      }
    };

    if (isInitiator) {
      const chatChan = pc.createDataChannel('chat', { ordered: true });
      this.setupDataChannelHandlers(targetSocketId, chatChan, 'chat');

      const wbChan = pc.createDataChannel('whiteboard', { ordered: false });
      this.setupDataChannelHandlers(targetSocketId, wbChan, 'whiteboard');
    } else {
      pc.ondatachannel = (event) => {
        const chan = event.channel;
        this.setupDataChannelHandlers(targetSocketId, chan, chan.label);
      };
    }

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket.emit('sdp-offer', {
          targetSocketId: targetSocketId,
          offer: offer
        });
      } catch (err) {
        console.error("Offer creation failed:", err);
      }
    }
  }

  async handleOffer(senderSocketId, offer) {
    const peer = this.peers[senderSocketId];
    if (!peer || !peer.pc) {
      await this.createPeerConnection(senderSocketId, peer ? peer.username : "Peer", false);
    }
    const pc = this.peers[senderSocketId].pc;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket.emit('sdp-answer', {
        targetSocketId: senderSocketId,
        answer: answer
      });
    } catch (err) {
      console.error("Offer handling failed:", err);
    }
  }

  async handleAnswer(senderSocketId, answer) {
    const peer = this.peers[senderSocketId];
    if (peer && peer.pc) {
      try {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error("Answer set failed:", err);
      }
    }
  }

  async handleIceCandidate(senderSocketId, candidate) {
    const peer = this.peers[senderSocketId];
    if (peer && peer.pc) {
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        // Ignored after connections settle
      }
    }
  }

  setupDataChannelHandlers(peerSocketId, channel, type) {
    if (type === 'chat') {
      this.peers[peerSocketId].chatChannel = channel;
    } else if (type === 'whiteboard') {
      this.peers[peerSocketId].whiteboardChannel = channel;
    }

    channel.onopen = () => {
      if (type === 'chat') window.roomUI.updateParticipantsList();
    };

    channel.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (type === 'chat') {
          await this.handleChatDataChannelMessage(peerSocketId, payload);
        } else if (type === 'whiteboard') {
          this.handleWhiteboardDataChannelMessage(payload);
        }
      } catch (err) {
        console.error("Failed parsing DataChannel JSON:", err);
      }
    };
  }

  async handleChatDataChannelMessage(senderSocketId, payload) {
    const senderName = this.peers[senderSocketId]?.username || "Peer";

    if (payload.type === 'chat-text') {
      try {
        const decryptedText = await window.cryptoHelper.decryptText(payload.data);
        window.roomUI.addChatMessage(senderName, decryptedText, false);
      } catch (err) {
        window.roomUI.addChatMessage(senderName, "🔒 [Encrypted Message - Unable to decrypt. Key mismatch?]", false, true);
      }
    } else if (payload.type === 'file-chunk') {
      await this.receiveFileChunk(senderName, payload);
    }
  }

  handleWhiteboardDataChannelMessage(payload) {
    if (payload.type === 'draw-action') {
      window.whiteboard.renderRemoteDrawAction(payload.action);
    }
  }

  closePeer(socketId) {
    if (this.peers[socketId]) {
      const peer = this.peers[socketId];
      if (peer.pc) peer.pc.close();
      delete this.peers[socketId];
      window.roomUI.removeVideoContainer(socketId);
      window.roomUI.updateParticipantsList();
    }
  }

  toggleMic(isActive) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = isActive;
      });
    }
  }

  toggleCam(isActive) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = isActive;
      });
      window.roomUI.toggleLocalPlaceholder(!isActive);
    }
  }

  async toggleScreenShare(isSharing) {
    if (isSharing) {
      try {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = this.screenStream.getVideoTracks()[0];

        for (const socketId in this.peers) {
          const peer = this.peers[socketId];
          if (peer.pc) {
            const senders = peer.pc.getSenders();
            const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
            if (videoSender) videoSender.replaceTrack(screenTrack);
          }
        }

        window.roomUI.setLocalStream(this.screenStream, true);
        screenTrack.onended = () => this.stopScreenShare();
        return true;
      } catch (err) {
        console.error("Screen share start error:", err);
        return false;
      }
    } else {
      this.stopScreenShare();
      return false;
    }
  }

  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }

    if (this.localStream) {
      const webcamTrack = this.localStream.getVideoTracks()[0];
      for (const socketId in this.peers) {
        const peer = this.peers[socketId];
        if (peer.pc) {
          const senders = peer.pc.getSenders();
          const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
          if (videoSender && webcamTrack) videoSender.replaceTrack(webcamTrack);
        }
      }
      const videoEnabled = webcamTrack ? webcamTrack.enabled : false;
      window.roomUI.setLocalStream(this.localStream, false);
      window.roomUI.toggleLocalPlaceholder(!videoEnabled);
    }
    window.roomUI.resetScreenShareButtonState();
  }

  async sendChatMessage(text) {
    if (!text.trim()) return;
    const encryptedText = await window.cryptoHelper.encryptText(text);
    const payload = JSON.stringify({ type: 'chat-text', data: encryptedText });

    for (const socketId in this.peers) {
      const peer = this.peers[socketId];
      if (peer.chatChannel && peer.chatChannel.readyState === 'open') {
        peer.chatChannel.send(payload);
      }
    }
    window.roomUI.addChatMessage("You", text, true);
  }

  async sendFile(file) {
    if (!file) return;
    const chunkSize = 16384;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const filename = file.name;
    const size = file.size;

    window.roomUI.addFileProgressBubble(filename, size, true);

    const reader = new FileReader();
    let offset = 0;
    let chunkIndex = 0;

    const readNextChunk = () => {
      const slice = file.slice(offset, offset + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = async (event) => {
      const arrayBuffer = event.target.result;
      try {
        const encryptedChunk = await window.cryptoHelper.encryptBuffer(arrayBuffer);
        const base64Chunk = window.cryptoHelper.arrayBufferToBase64(encryptedChunk);
        const payload = JSON.stringify({
          type: 'file-chunk',
          filename: filename,
          size: size,
          index: chunkIndex,
          total: totalChunks,
          data: base64Chunk
        });

        for (const socketId in this.peers) {
          const peer = this.peers[socketId];
          if (peer.chatChannel && peer.chatChannel.readyState === 'open') {
            peer.chatChannel.send(payload);
          }
        }

        chunkIndex++;
        const percent = Math.round((chunkIndex / totalChunks) * 100);
        window.roomUI.updateFileProgressBar(filename, percent, true);

        offset += chunkSize;
        if (offset < file.size) {
          readNextChunk();
        } else {
          window.roomUI.markFileProgressComplete(filename, null, true);
        }
      } catch (err) {
        console.error("File chunk send error:", err);
        window.roomUI.showSystemMessage(`Error sending file: ${filename}`);
      }
    };

    readNextChunk();
  }

  async receiveFileChunk(senderName, payload) {
    const { filename, size, index, total, data } = payload;

    if (!this.fileTransfers[filename]) {
      this.fileTransfers[filename] = {
        chunks: new Array(total),
        receivedChunks: 0,
        totalChunks: total,
        size: size,
        sender: senderName,
        isCorrupted: false
      };
      window.roomUI.addFileProgressBubble(filename, size, false, senderName);
    }

    const transfer = this.fileTransfers[filename];

    try {
      if (!transfer.isCorrupted) {
        const encryptedBuffer = window.cryptoHelper.base64ToArrayBuffer(data);
        const decryptedBuffer = await window.cryptoHelper.decryptBuffer(encryptedBuffer);
        transfer.chunks[index] = decryptedBuffer;
      }
    } catch (err) {
      transfer.isCorrupted = true;
    }

    transfer.receivedChunks++;
    const percent = Math.round((transfer.receivedChunks / transfer.totalChunks) * 100);
    window.roomUI.updateFileProgressBar(filename, percent, false);

    if (transfer.receivedChunks === transfer.totalChunks) {
      if (transfer.isCorrupted) {
        window.roomUI.markFileProgressComplete(filename, null, false, true);
        delete this.fileTransfers[filename];
        return;
      }
      const blob = new Blob(transfer.chunks);
      const downloadUrl = URL.createObjectURL(blob);
      window.roomUI.markFileProgressComplete(filename, downloadUrl, false, false);
      delete this.fileTransfers[filename];
    }
  }

  broadcastDrawAction(drawAction) {
    const payload = JSON.stringify({ type: 'draw-action', action: drawAction });
    for (const socketId in this.peers) {
      const peer = this.peers[socketId];
      if (peer.whiteboardChannel && peer.whiteboardChannel.readyState === 'open') {
        peer.whiteboardChannel.send(payload);
      }
    }
  }

  disconnectRoom() {
    for (const socketId in this.peers) {
      this.closePeer(socketId);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

window.webrtcManager = new WebRTCManager();
