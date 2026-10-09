// 1. CẤU HÌNH FIREBASE CHUẨN DỰ ÁN MENU-68F29
const firebaseConfig = {
  apiKey: "AIzaSyCc0CLn5AWsQ6qzd9EIRvf4H_Lw6dcZRoM",
  authDomain: "menu-68f29.firebaseapp.com",
  databaseURL: "https://menu-68f29-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "menu-68f29",
  storageBucket: "menu-68f29.firebasestorage.app",
  messagingSenderId: "677638363904",
  appId: "1:677638363904:web:8701d97a168c77672371e5",
  measurementId: "G-3GFLZP383T"
};

// Khởi tạo dịch vụ Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let activeTargetEmail = "";
const TWO_MINS_MS = 2 * 60 * 1000; // Khoảng thời gian khóa: 120.000 ms = 2 phút

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

// 3. XỬ LÝ ĐĂNG KÝ & ĐĂNG NHẬP
function register() {
  const e = document.getElementById("auth-email").value.trim();
  const p = document.getElementById("auth-password").value.trim();
  if (!e || !p) return alert("Vui lòng nhập đầy đủ Email và Mật khẩu!");

  auth.createUserWithEmailAndPassword(e, p)
    .then(res => {
      db.ref("users/" + res.user.uid).set({
        email: e,
        name: e.split("@")[0],
        avatar: "https://via.placeholder.com/100"
      });
    })
    .catch(err => alert("Lỗi đăng ký: " + err.message));
}

function login() {
  const e = document.getElementById("auth-email").value.trim();
  const p = document.getElementById("auth-password").value.trim();
  if (!e || !p) return alert("Vui lòng nhập đầy đủ Email và Mật khẩu!");

  auth.signInWithEmailAndPassword(e, p)
    .catch(err => alert("Lỗi đăng nhập: " + err.message));
}

function logout() {
  auth.signOut();
}

// 4. QUẢN LÝ TRANG CÁ NHÂN (PROFILE)
function loadUserProfile() {
  db.ref("users/" + currentUser.uid).on("value", snapshot => {
    const data = snapshot.val();
    if (data) {
      document.getElementById("my-name").innerText = data.name || currentUser.email;
      document.getElementById("my-email").innerText = data.email || currentUser.email;
      if (data.avatar) document.getElementById("my-avatar").src = data.avatar;
    }
  });
}

function editProfile() {
  const newName = prompt("Nhập tên hiển thị mới:");
  const newAvatar = prompt("Nhập link URL ảnh đại diện:");
  if (newName || newAvatar) {
    const updates = {};
    if (newName) updates.name = newName;
    if (newAvatar) updates.avatar = newAvatar;
    db.ref("users/" + currentUser.uid).update(updates);
  }
}

// 5. LỌC VÀ HIỂN THỊ CHAT REALTIME
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
      // Lọc tin nhắn hai chiều riêng tư giữa 2 tài khoản
      const isRelate = (msg.sender === currentUser.email && msg.receiver === activeTargetEmail) ||
                       (msg.sender === activeTargetEmail && msg.receiver === currentUser.email);

      if (isRelate) {
        renderMessage(msgId, msg);
      }
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

// 6. DỰNG GIAO DIỆN TIN NHẮN & KHÓA SỬA/THU HỒI SAU 2 PHÚT
function renderMessage(msgId, msg) {
  const chatBox = document.getElementById("chat-box");
  const isMe = msg.sender === currentUser.email;
  const elapsed = Date.now() - msg.timestamp;
  const isUnderTwoMins = elapsed <= TWO_MINS_MS;

  const div = document.createElement("div");
  div.className = `msg ${isMe ? "me" : ""}`;

  let contentText = msg.isRecalled ? "<i>Tin nhắn đã được thu hồi</i>" : msg.content;
  if (msg.isEdited && !msg.isRecalled) contentText += " <small style='opacity:0.6'>(Đã sửa)</small>";

  let actionButtons = "";
  // Chỉ chính chủ gửi và trong khoảng thời gian 2 phút mới hiện nút thao tác
  if (isMe && !msg.isRecalled && isUnderTwoMins) {
    const safeContent = msg.content.replace(/'/g, "\\'");
    actionButtons = `
      <div class="msg-actions">
        <span onclick="editMsg('${msgId}', '${safeContent}', ${msg.timestamp})">Sửa</span>
        <span onclick="recallMsg('${msgId}', ${msg.timestamp})">Thu hồi</span>
      </div>
    `;
  }

  div.innerHTML = `<div class="msg-content">${contentText}</div>${actionButtons}`;
  chatBox.appendChild(div);
}

// 7. GỬI TIN NHẮN
function sendMsg() {
  const input = document.getElementById("msg-input");
  const text = input.value.trim();
  if (!text || !activeTargetEmail) return;

  db.ref("messages").push({
    sender: currentUser.email,
    receiver: activeTargetEmail,
    content: text,
    timestamp: Date.now(),
    isEdited: false,
    isRecalled: false
  });
  input.value = "";
}

// 8. SỬA TIN NHẮN (KIỂM TRA LẠI THỜI GIAN)
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

// 9. THU HỒI TIN NHẮN (KIỂM TRA LẠI THỜI GIAN)
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
