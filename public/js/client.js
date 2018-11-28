// getting dom elements
var divSelectRoom = document.getElementById("selectRoom");
var divConsultingRoom = document.getElementById("consultingRoom");
var inputRoomNumber = document.getElementById("roomNumber");
var btnGoRoom = document.getElementById("goRoom");
var remoteVideo = document.getElementById("remoteVideo");
var canvas = document.getElementById("localCanvas");

// variables
var roomNumber;
var localStream;
var remoteStream;
var rtcPeerConnection;
var isCaller;

// constants
const iceServers = {
    'iceServers': [
        { 'url': 'stun:mtcnnRstun.services.mozilla.com' },
        { 'url': 'stun:stun.l.google.com:19302' }
    ]
}
const streamConstraints = { audio: true, video: true };
const mtcnnForwardParams = {
    // limiting the search space to larger faces for webcam detection
    minFaceSize: 200
}

//positions for sunglasess
var results = []

//utility functions
async function getFace(localVideo, options){
    results = await faceapi.mtcnn(localVideo, options)
}

// Let's do this
var socket = io();

btnGoRoom.onclick = function () {
    if (inputRoomNumber.value === '') {step
        alert("Please type a room number")
    } else {
        roomNumber = inputRoomNumber.value;
        socket.emit('create or join', roomNumber);
        divSelectRoom.style = "display: none;";
        divConsultingRoom.style = "display: block;";
    }
};

// message handlers
socket.on('created', async function (room) {
    await faceapi.loadMtcnnModel('/weights')
    await faceapi.loadFaceRecognitionModel('/weights')
    navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
        let localVideo = document.createElement("video")
        localVideo.srcObject = stream;
        localVideo.autoplay = true
        localVideo.addEventListener('playing', () => {
            let ctx = canvas.getContext("2d");
            let image = new Image()
            image.src = "img/sunglasses.png"
            
            function step() {
                getFace(localVideo, mtcnnForwardParams)
                ctx.drawImage(localVideo, 0, 0)
                results.map(result => {
                    ctx.drawImage(
                        image,
                        result.faceDetection.box.x + 15,
                        result.faceDetection.box.y + 30,
                        result.faceDetection.box.width,
                        result.faceDetection.box.width * (image.height / image.width)
                    )
                })
                requestAnimationFrame(step)
            }

            requestAnimationFrame(step)
        })

        localStream = canvas.captureStream(30)
        isCaller = true;
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices', err);
    });
});

socket.on('joined', async function (room) {
    await faceapi.loadMtcnnModel('/weights')
    await faceapi.loadFaceRecognitionModel('/weights')
    navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
        let localVideo = document.createElement("video")
        localVideo.srcObject = stream;
        localVideo.autoplay = true
        localVideo.addEventListener('playing', () => {
            let ctx = canvas.getContext("2d");
            let image = new Image()
            image.src = "img/sunglasses-style.png"

            function step() {
                getFace(localVideo, mtcnnForwardParams)
                ctx.drawImage(localVideo, 0, 0)
                results.map(result => {
                    ctx.drawImage(
                        image,
                        result.faceDetection.box.x,
                        result.faceDetection.box.y + 30,
                        result.faceDetection.box.width,
                        result.faceDetection.box.width * (image.height / image.width)
                    )
                })
                requestAnimationFrame(step)
            }
            
            requestAnimationFrame(step)
        })

        localStream = canvas.captureStream(30);
        socket.emit('ready', roomNumber);
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices', err);
    });
});

socket.on('candidate', function (event) {
    var candidate = new RTCIceCandidate({
        sdpMLineIndex: event.label,
        candidate: event.candidate
    });
    rtcPeerConnection.addIceCandidate(candidate);
});

socket.on('ready', function () {
    if (isCaller) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.onaddstream = onAddStream;
        rtcPeerConnection.addStream(localStream);
        rtcPeerConnection.createOffer(setLocalAndOffer, function (e) { console.log(e) });
    }
});

socket.on('offer', function (event) {
    if (!isCaller) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.onaddstream = onAddStream;
        rtcPeerConnection.addStream(localStream);
        rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
        rtcPeerConnection.createAnswer(setLocalAndAnswer, function (e) { console.log(e) });
    }
});

socket.on('answer', function (event) {
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
})

// handler functions
function onIceCandidate(event) {
    if (event.candidate) {
        console.log('sending ice candidate');
        socket.emit('candidate', {
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
            room: roomNumber
        })
    }
}

function onAddStream(event) {
    remoteVideo.srcObject = event.stream;
    remoteStream = event.stream;
}

function setLocalAndOffer(sessionDescription) {
    rtcPeerConnection.setLocalDescription(sessionDescription);
    socket.emit('offer', {
        type: 'offer',
        sdp: sessionDescription,
        room: roomNumber
    });
}

function setLocalAndAnswer(sessionDescription) {
    rtcPeerConnection.setLocalDescription(sessionDescription);
    socket.emit('answer', {
        type: 'answer',
        sdp: sessionDescription,
        room: roomNumber
    });
}