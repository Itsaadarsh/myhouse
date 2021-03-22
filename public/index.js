const socket = io();
let producer = null;

nameInput.value = 'user' + Math.round(Math.random() * 1000);

let rc = null;

function joinRoom(name, roomID) {
  if (rc && rc.isOpen()) {
    console.log('already connected to a room');
  } else {
    rc = new RoomClient(remoteAudios, window.mediasoupClient, socket, roomID, name, roomOpen);
    addListeners();
  }
}

function roomOpen() {
  login.style.display = 'none';
  reveal(startAudioButton);
  hide(stopAudioButton);
  reveal(exitButton);
  control.className = '';
}

function hide(elem) {
  elem.className = 'hidden';
}

function reveal(elem) {
  elem.className = '';
}

function addListeners() {
  rc.on(RoomClient.EVENTS.stopAudio, () => {
    hide(stopAudioButton);
    reveal(startAudioButton);
  });

  rc.on(RoomClient.EVENTS.startAudio, () => {
    hide(startAudioButton);
    reveal(stopAudioButton);
  });

  rc.on(RoomClient.EVENTS.exitRoom, () => {
    hide(control);
    reveal(login);
  });

  rc.on(RoomClient.EVENTS.defaultListener, () => {
    stopAudioButton.disabled = true;
    startAudioButton.disabled = true;
    beASpeaker.className = '';
  });

  rc.on(RoomClient.EVENTS.defaultSpeaker, () => {
    stopAudioButton.disabled = false;
    startAudioButton.disabled = false;
    beASpeaker.className = 'hidden';
  });
  rc.on(RoomClient.EVENTS.disableSpeaker, () => {
    beASpeaker.disabled = true;
  });
}

// Load mediaDevice options
navigator.mediaDevices.enumerateDevices().then(devices =>
  devices.forEach(device => {
    let el = null;
    if ('audioinput' === device.kind) {
      el = audioSelect;
    }
    if (!el) return;

    let option = document.createElement('option');
    option.value = device.deviceId;
    option.innerText = device.label;
    el.appendChild(option);
  })
);
