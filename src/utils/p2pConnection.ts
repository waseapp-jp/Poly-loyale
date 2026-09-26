// WebRTC Peer-to-Peer Data Channel Manager for low-latency direct 1v1 play

export type P2PState = 'idle' | 'connecting' | 'connected' | 'fallback_socket' | 'disconnected' | 'failed';

export interface P2PSignal {
  type: 'offer' | 'answer' | 'candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

class P2PManager {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private isHost: boolean = false;
  private state: P2PState = 'idle';
  private pingTime: number = 0;
  private lastPingSent: number = 0;
  private pingInterval: number | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  private onSignalCallback: ((signal: P2PSignal) => void) | null = null;
  private onDataCallback: ((data: any) => void) | null = null;
  private onStateCallback: ((state: P2PState, pingMs: number) => void) | null = null;

  private iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  public getState(): P2PState {
    return this.state;
  }

  public getPing(): number {
    return this.pingTime;
  }

  private setState(newState: P2PState) {
    this.state = newState;
    if (this.onStateCallback) {
      this.onStateCallback(this.state, this.pingTime);
    }
  }

  // Host initializes P2P connection and creates RTCDataChannel
  public async initAsHost(
    onSignal: (signal: P2PSignal) => void,
    onData: (data: any) => void,
    onState: (state: P2PState, pingMs: number) => void
  ) {
    this.cleanup();
    this.isHost = true;
    this.onSignalCallback = onSignal;
    this.onDataCallback = onData;
    this.onStateCallback = onState;
    this.pendingCandidates = [];
    this.setState('connecting');

    try {
      this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

      this.pc.onicecandidate = (event) => {
        if (event.candidate && this.onSignalCallback) {
          this.onSignalCallback({
            type: 'candidate',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      this.pc.onconnectionstatechange = () => {
        if (!this.pc) return;
        const s = this.pc.connectionState;
        if (s === 'connected') {
          this.setState('connected');
          this.startPingLoop();
        } else if (s === 'failed' || s === 'disconnected') {
          if (this.state === 'connected') {
            this.setState('fallback_socket');
          } else {
            this.setState('failed');
          }
        }
      };

      // Create DataChannel with ultra-low latency unordered settings
      this.dataChannel = this.pc.createDataChannel('poly_p2p_channel', {
        ordered: false,
        maxRetransmits: 0,
      });

      this.setupDataChannel(this.dataChannel);

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      if (this.onSignalCallback) {
        this.onSignalCallback({
          type: 'offer',
          sdp: offer,
        });
      }
    } catch (err) {
      console.error('P2P Host setup error:', err);
      this.setState('fallback_socket');
    }
  }

  // Guest initializes P2P connection to receive RTCDataChannel
  public async initAsGuest(
    onSignal: (signal: P2PSignal) => void,
    onData: (data: any) => void,
    onState: (state: P2PState, pingMs: number) => void
  ) {
    this.cleanup();
    this.isHost = false;
    this.onSignalCallback = onSignal;
    this.onDataCallback = onData;
    this.onStateCallback = onState;
    this.pendingCandidates = [];
    this.setState('connecting');

    try {
      this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

      this.pc.onicecandidate = (event) => {
        if (event.candidate && this.onSignalCallback) {
          this.onSignalCallback({
            type: 'candidate',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      this.pc.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel(this.dataChannel);
      };

      this.pc.onconnectionstatechange = () => {
        if (!this.pc) return;
        const s = this.pc.connectionState;
        if (s === 'connected') {
          this.setState('connected');
          this.startPingLoop();
        } else if (s === 'failed' || s === 'disconnected') {
          if (this.state === 'connected') {
            this.setState('fallback_socket');
          } else {
            this.setState('failed');
          }
        }
      };
    } catch (err) {
      console.error('P2P Guest setup error:', err);
      this.setState('fallback_socket');
    }
  }

  // Process incoming SDP offer/answer or ICE candidate with queueing
  public async handleIncomingSignal(signal: P2PSignal) {
    if (!this.pc) return;

    try {
      if (signal.type === 'offer' && !this.isHost) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp!));
        
        // Drain pending candidates that arrived before remote description
        while (this.pendingCandidates.length > 0) {
          const cand = this.pendingCandidates.shift();
          if (cand) {
            await this.pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        }

        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        if (this.onSignalCallback) {
          this.onSignalCallback({
            type: 'answer',
            sdp: answer,
          });
        }
      } else if (signal.type === 'answer' && this.isHost) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp!));
        
        // Drain pending candidates
        while (this.pendingCandidates.length > 0) {
          const cand = this.pendingCandidates.shift();
          if (cand) {
            await this.pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (this.pc.remoteDescription && this.pc.remoteDescription.type) {
          await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          this.pendingCandidates.push(signal.candidate);
        }
      }
    } catch (err) {
      console.warn('P2P Signal handle error:', err);
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.onopen = () => {
      this.setState('connected');
      this.startPingLoop();
    };

    channel.onclose = () => {
      this.setState('fallback_socket');
    };

    channel.onerror = (err) => {
      console.warn('P2P DataChannel error:', err);
      this.setState('fallback_socket');
    };

    channel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.p2pType === '__ping__') {
          // Respond to ping with pong
          this.send({ p2pType: '__pong__', sentAt: parsed.sentAt });
          return;
        } else if (parsed.p2pType === '__pong__') {
          const rtt = Math.max(1, Math.round(performance.now() - parsed.sentAt));
          this.pingTime = rtt;
          if (this.onStateCallback) {
            this.onStateCallback(this.state, this.pingTime);
          }
          return;
        }

        if (this.onDataCallback) {
          this.onDataCallback(parsed);
        }
      } catch {
        if (this.onDataCallback) {
          this.onDataCallback(event.data);
        }
      }
    };
  }

  public send(data: any): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        this.dataChannel.send(payload);
        return true;
      } catch (err) {
        console.warn('P2P send error:', err);
      }
    }
    return false;
  }

  private startPingLoop() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = window.setInterval(() => {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.lastPingSent = performance.now();
        this.send({ p2pType: '__ping__', sentAt: this.lastPingSent });
      }
    }, 2000);
  }

  public cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch {}
      this.pc = null;
    }
    this.pendingCandidates = [];
    this.state = 'idle';
    this.pingTime = 0;
  }
}

export const p2pManager = new P2PManager();
