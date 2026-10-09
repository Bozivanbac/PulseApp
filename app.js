// 1. CẤU HÌNH FIREBASE (Dán mã của bạn vào đây)
const firebaseConfig = {
  apiKey: "ĐIỀN_API_KEY_CỦA_BẠN",
  authDomain: "ĐIỀN_AUTH_DOMAIN",
  databaseURL: "ĐIỀN_DATABASE_URL",
  projectId: "ĐIỀN_PROJECT_ID",
  storageBucket: "ĐIỀN_STORAGE_BUCKET",
  messagingSenderId: "ĐIỀN_SENDER_ID",
  appId: "ĐIỀN_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let activeTargetEmail = "";
const TWO_MINS_MS = 2 * 60 * 1000; // 120.000 ms = 2 phút

// 2. THEO DÕI TRẠNG THÁI ĐĂNG NHẬP
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("app-screen").classList.remove("hidden");
    loadUserProfile();
  } else {
    document.getElementById("auth-screen").classList.remove("hidden");
    document.getElementById("app-screen").classList.add("hidden");
  }
});

// 3. ĐĂNG KÝ / ĐĂNG NHẬP
function register() {
  const e = document.getElementById("auth-email").value;
  const p = document.getElementById("auth-password").value;
  auth.createUserWithEmailAndPassword(e, p).then(res => {
    // Tạo profile mặc định
    db.ref("users/" + res.user.uid).set({
      email: e,
      name: e.split("@")[0],
      avatar: "https://via.placeholder.com/100"
    });
  }).catch(err => alert(err.message));
}

function login() {
  const e = document.getElementById("auth-email").value;
  const p = document.getElementById("auth-password").value;
  auth.signInWithEmailAndPassword(e, p).catch(err => alert(err.message));
}

function logout() { auth.signOut(); }

// 4. TRANG CÁ NHÂN (PROFILE)
function loadUserProfile() {
  db.ref("users/" + currentUser.uid).on("value", snapshot => {
    const data = snapshot.val();
    if (data) {
      document.getElementById("my-name").innerText = data.name;
      document.getElementById("my-email").innerText = data.email;
      document.getElementById("my-avatar").src = data.avatar;
    }
  });
}

function editProfile() {
  const newName = prompt("Nhập tên hiển thị mới:");
  const newAvatar = prompt("Nhập link URL ảnh đại diện:");
  if (newName || newAvatar) {
    db.ref("users/" + currentUser.uid).update({
      name: newName || document.getElementById("my-name").innerText,
      avatar: newAvatar || document.getElementById("my-avatar").src
    });
  }
}

// 5. KHU VỰC CHAT REALTIME
function startChat() {
  activeTargetEmail = document.getElementById("target-email").value.trim();
  if (!activeTargetEmail) return alert("Vui lòng nhập Email người nhận!");
  listenMessages();
}

function listenMessages() {
  db.ref("messages").on("value", snapshot => {
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = "";
    const data = snapshot.val();
    
    if (!data) return;

    Object.keys(data).forEach(msgId => {
      const msg = data[msgId];
      // Chỉ hiển thị tin nhắn giữa 2 người này
      const isRelate = (msg.sender === currentUser.email && msg.receiver === activeTargetEmail) ||
                       (msg.sender === activeTargetEmail && msg.receiver === currentUser.email);

      if (isRelate) {
        renderMessage(msgId, msg);
      }
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

// 6. HIỂN THỊ TIN NHẮN & KIỂM TRA LOGIC 2 PHÚT
function renderMessage(msgId, msg) {
  const chatBox = document.getElementById("chat-box");
  const isMe = msg.sender === currentUser.email;
  const elapsed = Date.now() - msg.timestamp;
  const isUnderTwoMins = elapsed <= TWO_MINS_MS;

  const div = document.createElement("div");
  div.className = `msg ${isMe ? "me" : ""}`;

  let contentText = msg.isRecalled ? "<i>Tin nhắn đã được thu hồi</i>" : msg.content;
  if (msg.isEdited && !msg.isRecalled) contentText += " <small>(Đã sửa)</small>";

  let actionButtons = "";
  // Chỉ chính chủ gửi và chưa quá 2 phút mới hiện nút Sửa/Thu hồi
  if (isMe && !msg.isRecalled && isUnderTwoMins) {
    actionButtons = `
      <div class="msg-actions">
        <span onclick="editMsg('${msgId}', '${msg.content}', ${msg.timestamp})">Sửa</span>
        <span onclick="recallMsg('${msgId}', ${msg.timestamp})">Thu hồi</span>
      </div>
    `;
  }

  div.innerHTML = `<div>${contentText}</div>${actionButtons}`;
  chatBox.appendChild(div);
}

// 7. GỬI TIN NHẮN MỚI
function sendMsg() {
  const input = document.getElementById("msg-input");
  if (!input.value.trim() || !activeTargetEmail) return;

  db.ref("messages").push({
    sender: currentUser.email,
    receiver: activeTargetEmail,
    content: input.value,
    timestamp: Date.now(),
    isEdited: false,
    isRecalled: false
  });
  input.value = "";
}

// 8. CHỈNH SỬA TIN NHẮN (KIỂM TRA LẠI THỜI GIAN KHI BẤM)
function editMsg(msgId, oldContent, timestamp) {
  if (Date.now() - timestamp > TWO_MINS_MS) {
    alert("Đã quá 2 phút! Không thể chỉnh sửa nữa.");
    return;
  }
  const newContent = prompt("Sửa tin nhắn:", oldContent);
  if (newContent && newContent !== oldContent) {
    db.ref("messages/" + msgId).update({
      content: newContent,
      isEdited: true
    });
  }
}

// 9. THU HỒI TIN NHẮN (KIỂM TRA LẠI THỜI GIAN KHI BẤM)
function recallMsg(msgId, timestamp) {
  if (Date.now() - timestamp > TWO_MINS_MS) {
    alert("Đã quá 2 phút! Không thể thu hồi nữa.");
    return;
  }
  if (confirm("Bạn có chắc muốn thu hồi tin nhắn này?")) {
    db.ref("messages/" + msgId).update({
      isRecalled: true
    });
  }
}