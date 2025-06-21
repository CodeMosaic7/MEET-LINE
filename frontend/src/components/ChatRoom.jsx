import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const URL = "http://localhost:3000";

export const ChatRoom = ({ name, localAudioTrack, localVideoTrack }) => {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(
    "Searching for a match..."
  );
  const [otherUser, setOtherUser] = useState(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const [queuedIceCandidates, setQueuedIceCandidates] = useState([]);

  // Initialize Socket connection and find match
  useEffect(() => {
    console.log("Initializing connection and searching for match...");

    const newSocket = io(URL, {
      transports: ["websocket", "polling"],
    });
    setSocket(newSocket);

    // Socket event handlers
    newSocket.on("connect", () => {
      console.log("Socket connected, searching for match...");
      setConnectionStatus("Searching for a match...");
      // Join the matching system - don't specify a roomId, let backend handle it
      newSocket.emit("join-room", { name });
    });

    newSocket.on("waiting", ({ message }) => {
      console.log("Waiting for match:", message);
      setConnectionStatus("Waiting for another user...");
    });

    newSocket.on(
      "successfulConnection",
      ({ roomId: newRoomId, otherUser: otherUserInfo }) => {
        console.log(
          "Successfully matched! Room:",
          newRoomId,
          "Other user:",
          otherUserInfo
        );
        setRoomId(newRoomId);
        setOtherUser(otherUserInfo);
        setConnectionStatus("Matched! Setting up video call...");

        // Now initialize WebRTC since we have a room
        initializeWebRTC(newSocket, newRoomId);
      }
    );

    newSocket.on("user-left", ({ roomId: leftRoomId }) => {
      console.log("Other user left the room:", leftRoomId);
      setConnectionStatus("Other user left. Searching for new match...");
      setIsConnected(false);
      setRoomId(null);
      setOtherUser(null);

      // Clean up peer connection
      if (peerConnection) {
        peerConnection.close();
        setPeerConnection(null);
      }

      // Clear queued ICE candidates
      setQueuedIceCandidates([]);

      // Search for new match
      newSocket.emit("join-room", { name });
    });

    newSocket.on("roomClosed", ({ roomId: closedRoomId }) => {
      console.log("Room closed:", closedRoomId);
      setConnectionStatus("Room closed. Searching for new match...");
      setIsConnected(false);
      setRoomId(null);
      setOtherUser(null);

      // Clean up peer connection
      if (peerConnection) {
        peerConnection.close();
        setPeerConnection(null);
      }

      // Clear queued ICE candidates
      setQueuedIceCandidates([]);
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
      setConnectionStatus("Disconnected");
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setConnectionStatus("Connection error");
    });

    // Cleanup function
    return () => {
      console.log("Cleaning up connections");
      newSocket.disconnect();
      if (peerConnection) {
        peerConnection.close();
      }
      setSocket(null);
      setPeerConnection(null);
      setIsConnected(false);
      setQueuedIceCandidates([]);
    };
  }, [name]); // Only depend on name, not the tracks

  // Initialize WebRTC when we get matched
  const initializeWebRTC = (socket, currentRoomId) => {
    console.log("🚀 Initializing WebRTC for room:", currentRoomId);

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    setPeerConnection(pc);

    // Create a single MediaStream for local tracks
    const localStream = new MediaStream();

    try {
      if (localVideoTrack) {
        localStream.addTrack(localVideoTrack);
        pc.addTrack(localVideoTrack, localStream);
        console.log("✅ Added video track to peer connection");
      } else {
        console.warn("⚠️ No local video track available");
      }

      if (localAudioTrack) {
        localStream.addTrack(localAudioTrack);
        pc.addTrack(localAudioTrack, localStream);
        console.log("✅ Added audio track to peer connection");
      } else {
        console.warn("⚠️ No local audio track available");
      }
    } catch (error) {
      console.error("❌ Error adding tracks:", error);
    }

    // Enhanced connection state tracking
    pc.onconnectionstatechange = () => {
      console.log("🔄 Connection state changed to:", pc.connectionState);
      console.log("🔄 ICE connection state:", pc.iceConnectionState);
      console.log("🔄 ICE gathering state:", pc.iceGatheringState);

      setIsConnected(pc.connectionState === "connected");

      switch (pc.connectionState) {
        case "connected":
          setConnectionStatus("Connected!");
          break;
        case "connecting":
          setConnectionStatus("Connecting to peer...");
          break;
        case "failed":
          setConnectionStatus("Connection failed");
          console.error("❌ WebRTC connection failed");
          break;
        case "disconnected":
          setConnectionStatus("Disconnected");
          break;
        case "closed":
          setConnectionStatus("Connection closed");
          break;
      }
    };

    // Enhanced ICE candidate handling
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        console.log(
          "🧊 Sending ICE candidate:",
          e.candidate.type,
          "for room:",
          currentRoomId
        );
        socket.emit("add-ice-candidate", {
          roomId: currentRoomId,
          candidate: e.candidate,
        });
      } else {
        console.log("🧊 ICE gathering completed");
      }
    };

    // Enhanced remote stream handling
    pc.ontrack = (event) => {
      console.log("📹 Received remote track event");
      console.log("📹 Track kind:", event.track.kind);
      console.log("📹 Track state:", event.track.readyState);
      console.log("📹 Number of streams:", event.streams.length);

      if (event.streams && event.streams[0]) {
        console.log("📹 Setting remote video stream");

        // Log track details
        event.streams[0].getTracks().forEach((track) => {
          console.log(
            "📹 Track:",
            track.kind,
            "enabled:",
            track.enabled,
            "state:",
            track.readyState
          );
        });

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setConnectionStatus("Video call active!");

          // Add event listeners to the remote video element
          remoteVideoRef.current.onloadedmetadata = () => {
            console.log("📹 Remote video metadata loaded");
            console.log(
              "📹 Remote video dimensions:",
              remoteVideoRef.current.videoWidth,
              "x",
              remoteVideoRef.current.videoHeight
            );
          };

          remoteVideoRef.current.onplay = () => {
            console.log("📹 Remote video started playing");
          };

          remoteVideoRef.current.onerror = (error) => {
            console.error("📹 Remote video error:", error);
          };

          remoteVideoRef.current.onloadstart = () => {
            console.log("📹 Remote video load started");
          };

          remoteVideoRef.current.oncanplay = () => {
            console.log("📹 Remote video can play");
          };
        } else {
          console.error("❌ Remote video ref is null");
        }
      } else {
        console.error("❌ No remote stream received");
      }
    };

    // Add ICE connection state change handler
    pc.oniceconnectionstatechange = () => {
      console.log("🧊 ICE connection state:", pc.iceConnectionState);

      switch (pc.iceConnectionState) {
        case "checking":
          console.log("🧊 ICE candidates are being checked");
          break;
        case "connected":
          console.log("✅ ICE connection established");
          break;
        case "completed":
          console.log("✅ ICE connection completed");
          break;
        case "failed":
          console.error("❌ ICE connection failed");
          break;
        case "disconnected":
          console.warn("⚠️ ICE connection disconnected");
          break;
        case "closed":
          console.log("🔒 ICE connection closed");
          break;
      }
    };

    // Process queued ICE candidates when remote description is set
    const processQueuedCandidates = async () => {
      if (queuedIceCandidates.length > 0 && pc.remoteDescription) {
        console.log(
          "🧊 Processing",
          queuedIceCandidates.length,
          "queued ICE candidates"
        );
        for (const candidate of queuedIceCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("✅ Added queued ICE candidate");
          } catch (error) {
            console.error("❌ Error adding queued ICE candidate:", error);
          }
        }
        setQueuedIceCandidates([]);
      }
    };

    // WebRTC signaling handlers with enhanced error handling
    socket.on("send-offer", async ({ roomId: offerRoomId }) => {
      if (offerRoomId !== currentRoomId) {
        console.warn(
          "⚠️ Received send-offer for different room:",
          offerRoomId,
          "vs",
          currentRoomId
        );
        return;
      }

      try {
        console.log("📤 Creating offer for room:", offerRoomId);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        console.log("📤 Local description set, sending offer");
        socket.emit("offer", { roomId: offerRoomId, sdp: offer });
      } catch (error) {
        console.error("❌ Error creating offer:", error);
      }
    });

    socket.on("offer", async ({ roomId: offerRoomId, sdp }) => {
      if (offerRoomId !== currentRoomId) {
        console.warn(
          "⚠️ Received offer for different room:",
          offerRoomId,
          "vs",
          currentRoomId
        );
        return;
      }

      try {
        console.log(
          "📥 Received offer, creating answer for room:",
          offerRoomId
        );
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log("📥 Remote description set");

        // Process any queued ICE candidates
        await processQueuedCandidates();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("📤 Answer created and local description set");

        socket.emit("answer", { roomId: offerRoomId, sdp: answer });
        console.log("📤 Answer sent");
      } catch (error) {
        console.error("❌ Error handling offer:", error);
      }
    });

    socket.on("answer", async ({ roomId: answerRoomId, sdp }) => {
      if (answerRoomId !== currentRoomId) {
        console.warn(
          "⚠️ Received answer for different room:",
          answerRoomId,
          "vs",
          currentRoomId
        );
        return;
      }

      try {
        console.log("📥 Received answer for room:", answerRoomId);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log("✅ Remote description set from answer");

        // Process any queued ICE candidates
        await processQueuedCandidates();
      } catch (error) {
        console.error("❌ Error handling answer:", error);
      }
    });

    socket.on(
      "add-ice-candidate",
      async ({ roomId: candidateRoomId, candidate }) => {
        if (candidateRoomId !== currentRoomId) {
          console.warn(
            "⚠️ Received ICE candidate for different room:",
            candidateRoomId,
            "vs",
            currentRoomId
          );
          return;
        }

        try {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("✅ ICE candidate added for room:", candidateRoomId);
          } else {
            console.log(
              "⏳ Queueing ICE candidate - waiting for remote description"
            );
            setQueuedIceCandidates((prev) => [...prev, candidate]);
          }
        } catch (error) {
          console.error("❌ Error adding ICE candidate:", error);
        }
      }
    );
  };

  // Show local video
  useEffect(() => {
    if (localVideoRef.current && localVideoTrack) {
      const stream = new MediaStream([localVideoTrack]);
      if (localAudioTrack) {
        stream.addTrack(localAudioTrack);
      }
      localVideoRef.current.srcObject = stream;
      console.log("📹 Local video stream set");
    }
  }, [localVideoTrack, localAudioTrack]);

  return (
    <div style={{ padding: "20px" }}>
      <h3>Hi {name}!</h3>

      {roomId && otherUser && (
        <div style={{ marginBottom: "10px" }}>
          <strong>Room:</strong> {roomId} | <strong>Matched with:</strong>{" "}
          {otherUser.name}
        </div>
      )}

      <div style={{ marginBottom: "10px" }}>
        <strong>Status:</strong> {connectionStatus}
      </div>

      {/* Debug Information */}
      {roomId && (
        <div style={{ marginBottom: "10px", fontSize: "12px", color: "#666" }}>
          <div>
            ICE Connection: {peerConnection?.iceConnectionState || "N/A"}
          </div>
          <div>
            Connection State: {peerConnection?.connectionState || "N/A"}
          </div>
          <div>Queued ICE Candidates: {queuedIceCandidates.length}</div>
        </div>
      )}

      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
        <div>
          <h4>Your Video</h4>
          <video
            autoPlay
            playsInline
            muted // Always mute local video to prevent echo
            width={400}
            height={300}
            ref={localVideoRef}
            style={{ border: "1px solid #ccc", backgroundColor: "#000" }}
          />
        </div>

        <div>
          <h4>
            {otherUser ? `${otherUser.name}'s Video` : "Waiting for partner..."}
          </h4>
          <video
            autoPlay
            playsInline
            width={400}
            height={300}
            ref={remoteVideoRef}
            style={{ border: "1px solid #ccc", backgroundColor: "#000" }}
          />
        </div>
      </div>

      {!isConnected && roomId && (
        <div style={{ marginTop: "10px", color: "#666" }}>
          <p>Setting up peer-to-peer connection...</p>
        </div>
      )}
    </div>
  );
};
