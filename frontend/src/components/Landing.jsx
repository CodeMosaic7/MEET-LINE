import { useEffect, useRef, useState } from "react";
import { ChatRoom } from "./ChatRoom";

export const Landing = () => {
  const [name, setName] = useState("");
  const [remoteVideoTrack, setRemoteVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const videoRef = useRef(null);

  const [joined, setJoined] = useState(false);

  const getCam = async () => {
    try {
      const stream = await window.navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      const audioTrack = stream.getAudioTracks()[0];
      console.log(audioTrack)
      const videoTrack = stream.getVideoTracks()[0];
      console.log(videoTrack)
      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log("videoref set") // Directly assign the stream
      }
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  };

  useEffect(() => {
    getCam();

    // Cleanup function to stop tracks when component unmounts
    return () => {
      if (localAudioTrack) localAudioTrack.stop();
      if (localVideoTrack) localVideoTrack.stop();
    };
  }, []);

  if (!joined) {
    return (
      <div>
        <video autoPlay ref={videoRef} playsInline />
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          onClick={() => {
            if (name.trim() !== "") {
              setJoined(true);
            } else {
              alert("Please enter your name.");
            }
          }}
        >
          Connect
        </button>
      </div>
    );
  }

  return <ChatRoom name={name} localAudioTrack={localAudioTrack} localVideoTrack={localVideoTrack} />;
};
