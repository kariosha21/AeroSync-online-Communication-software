# AeroSync-online-Communication-software
AeroSync is a premium WebRTC video conferencing &amp; real-time collaboration tool featuring client-side End-to-End Encryption (E2EE) via Web Crypto API. Includes multi-user voice/video, screen sharing, P2P encrypted file transfer, chat, &amp; a synchronized shared canvas whiteboard in a glassmorphic UI.


# AeroSync ⚡

A premium, high-performance, and visually stunning WebRTC-based video conferencing and real-time collaboration tool equipped with **client-side End-to-End Encryption (E2EE)**. 

AeroSync is self-contained, leveraging a Node.js/Express backend for secure user authentication and signaling, combined with a client-driven peer-to-peer (P2P) mesh network for secure communication (audio, video, screen share, encrypted file transfer, chat, and whiteboard).

---

## 🌟 Key Features

*   **🔒 True End-to-End Encryption (E2EE)**: Chats, whiteboard operations, and files are encrypted client-side using the browser's native **Web Crypto API** before transmission. Encryption keys are derived locally and never transit through or get stored on the server.
*   **📡 Multi-User Video Calling**: Dynamic P2P mesh WebRTC topology utilizing public Google STUN servers. Supports microphone and webcam toggles on-the-fly.
*   **🖥️ Real-time Screen Sharing**: Seamlessly captures display media and hot-swaps tracks on all active peer connections without interrupting the call.
*   **🎨 Shared Interactive Whiteboard**: Collaborative drawing canvas synchronized with low-latency over WebRTC Data Channels. Features brush sizes, colors, an eraser, and canvas history redrawing on window resize.
*   **📁 Secure File Sharing**: Direct peer-to-peer file transfer. Files are encrypted client-side, split into 16KB chunks, transmitted over data channels, and reassembled/decrypted on the recipient's machine.
*   **✨ Premium Glassmorphic Design**: Designed with modern visual principles featuring translucent panels, glowing neon gradients, custom scrollbars, and dynamic layout scaling.
*   **👤 Hashed User Accounts**: Node.js/Express backend authentication system using JSON Web Tokens (JWT) for session management and Bcryptjs for secure password hashing.

---

## 🛡️ E2EE Security Architecture

AeroSync implements an advanced cryptographic model to ensure call contents remain private:

1.  **Client-Side Derivation**: When a room is created or joined, the encryption password is read from the URL hash fragment (e.g., `#room=UUID&key=roomPassword`). Because standard browsers **never send URL hash fragments to the server in HTTP requests**, the password remains strictly local.
2.  **Key Derivation**: The client uses the **PBKDF2** algorithm with **100,000 iterations** of SHA-256 and a room-specific salt to derive a strong 256-bit AES-GCM key.
3.  **Transport Encryption**: All chat messages, whiteboard coordinates, and file chunks are encrypted with **AES-GCM** using a cryptographically random 12-byte initialization vector (IV) generated for each payload. The payload is sent directly peer-to-peer over secure WebRTC Data Channels.

---

## 📂 Project Structure


---

## 🚀 Quick Start

### Prerequisites
*   Node.js (v16.0.0 or higher recommended)
*   npm (installed with Node)

### Installation
1. Clone the repository to your local system.
2. Open a terminal inside the project directory.
3. Install the dependencies using the disabled SSL flag (handy for setups behind proxies or intercepting CAs):
   ```bash
   npm install --strict-ssl=false
   npm start

   💻 Manual Verification & Testing Guide
To test the application locally with multiple users:

Lobby setup: Open http://localhost:3000 in a browser tab. Create an account, log in, enter an encryption key (e.g. pass123) under Create New Room, and enter.
Acquire invite: Click the Room ID badge at the top-left to copy the invitation link (contains the room ID and encryption password in the URL hash fragment).
Peer connection: Open a separate browser window in Incognito/Private mode (to avoid session collisions) and paste the link. Sign up/log in with a different username, enter pass123 when prompted, and click Unlock & Connect.
Audio/Video & Whiteboard: Verify that the video grids show both streams. Click the Whiteboard toggle on both clients and draw—strokes will sync in real-time.
Secure File Transfers: Open the chat sidebar, click the attachment clip icon, select a file, and send. Watch the progress bars complete. The recipient can download the file locally.
E2EE Verification Check: Open a third window, paste the room URL, but input a wrong password (e.g. wrong456). Try joining the same room. The peer connection will establish, but Client 3's incoming chat messages and file transfers will display warning indicators: [Encrypted Message - Unable to decrypt] showing that the key derivation prevents decryption.
