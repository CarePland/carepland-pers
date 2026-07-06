import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const displayName = searchParams.get("receiverName") || "Rob Robson";
  const locationLabel = searchParams.get("locationLabel") || "Living Rm";
  const appointmentTitle = searchParams.get("appointmentTitle") || "Cardiology Follow-Up";
  const appointmentDay = searchParams.get("appointmentDay") || "Tomorrow";
  const appointmentTime = searchParams.get("appointmentTime") || "2 PM";

  return new Response(
    classicWebViewReceiverHtml({
      appointmentDay,
      appointmentTime,
      appointmentTitle,
      displayName,
      locationLabel,
    }),
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      },
    }
  );
}

function classicWebViewReceiverHtml({
  appointmentDay,
  appointmentTime,
  appointmentTitle,
  displayName,
  locationLabel,
}: {
  appointmentDay: string;
  appointmentTime: string;
  appointmentTitle: string;
  displayName: string;
  locationLabel: string;
}) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>CarePland Receiver</title>
  <style>
    html, body {
      background: #e3e7e1;
      color: #101915;
      font-family: Arial, Helvetica, sans-serif;
      height: 100%;
      margin: 0;
      overflow: hidden;
      width: 100%;
    }
    button {
      font-family: Arial, Helvetica, sans-serif;
    }
    .screen {
      box-sizing: border-box;
      display: none;
      height: 100%;
      padding: 14px 20px;
      width: 100%;
    }
    .screenActive {
      display: block;
    }
    .homeTop {
      display: table;
      height: 138px;
      table-layout: fixed;
      width: 100%;
    }
    .topCell {
      display: table-cell;
      vertical-align: middle;
      width: 33.333%;
    }
    .time {
      font-size: 52px;
      font-weight: 900;
      line-height: 1;
    }
    .date {
      color: #5d6961;
      font-size: 26px;
      font-weight: 900;
      margin-top: 8px;
    }
    .apptPill {
      background: #fbfaf5;
      border: 3px solid #8f9991;
      border-radius: 6px;
      box-sizing: border-box;
      margin: 0 auto;
      max-width: 430px;
      padding: 10px 16px;
      text-align: center;
    }
    .apptDay {
      color: #5d6961;
      font-size: 26px;
      font-weight: 900;
    }
    .apptTitle {
      font-size: 29px;
      font-weight: 900;
      line-height: 1.05;
      margin-top: 4px;
    }
    .apptTime {
      color: #5d6961;
      font-size: 29px;
      font-weight: 900;
      margin-top: 4px;
    }
    .person {
      text-align: right;
    }
    .greeting {
      color: #5d6961;
      font-size: 25px;
      font-weight: 900;
    }
    .name {
      color: #5d6961;
      font-size: 41px;
      font-weight: 900;
      line-height: 1.02;
    }
    .room {
      color: #5d6961;
      font-size: 25px;
      font-weight: 900;
      margin-top: 5px;
    }
    .grid {
      box-sizing: border-box;
      display: table;
      height: calc(100% - 154px);
      margin-top: 16px;
      table-layout: fixed;
      width: 100%;
    }
    .row {
      display: table-row;
    }
    .cell {
      box-sizing: border-box;
      display: table-cell;
      height: 50%;
      padding: 10px 14px;
      vertical-align: middle;
      width: 50%;
    }
    .bigButton {
      background: #1f6d19;
      border: 5px solid #10470d;
      border-radius: 7px;
      box-shadow: 0 8px 0 #6f6b61;
      box-sizing: border-box;
      color: #ffffff;
      display: block;
      font-size: 42px;
      font-weight: 900;
      height: 100%;
      line-height: 1.05;
      text-align: center;
      width: 100%;
    }
    .blue {
      background: #326894;
      border-color: #1d4c73;
    }
    .toolbar {
      display: table;
      table-layout: fixed;
      width: 100%;
    }
    .toolbarTitle {
      display: table-cell;
      font-size: 44px;
      font-weight: 900;
      line-height: 1.05;
      vertical-align: middle;
    }
    .toolbarAction {
      display: table-cell;
      text-align: right;
      vertical-align: middle;
      width: 250px;
    }
    .homeButton {
      background: #fbfaf5;
      border: 3px solid #aeb6b0;
      border-radius: 6px;
      box-shadow: 0 6px 0 #77736a;
      color: #101915;
      font-size: 30px;
      font-weight: 900;
      height: 72px;
      width: 230px;
    }
    .panelBody {
      box-sizing: border-box;
      height: calc(100% - 95px);
      padding-top: 20px;
    }
    .whiteCard {
      background: #fbfaf5;
      border: 3px solid #aeb6b0;
      border-radius: 6px;
      box-sizing: border-box;
      height: 100%;
      padding: 24px 30px;
      width: 100%;
    }
    .questionInput {
      border: 4px solid #aeb6b0;
      border-radius: 6px;
      box-sizing: border-box;
      color: #101915;
      display: block;
      font-size: 40px;
      font-weight: 900;
      height: 145px;
      padding: 20px;
      resize: none;
      width: 100%;
    }
    .quickGrid {
      display: table;
      margin-top: 18px;
      table-layout: fixed;
      width: 100%;
    }
    .quickRow {
      display: table-row;
    }
    .quickCell {
      box-sizing: border-box;
      display: table-cell;
      padding: 8px;
      width: 50%;
    }
    .quickButton {
      background: #fbfaf5;
      border: 3px solid #aeb6b0;
      border-radius: 6px;
      box-shadow: 0 5px 0 #77736a;
      color: #101915;
      font-size: 26px;
      font-weight: 900;
      height: 74px;
      width: 100%;
    }
    .sendButton {
      background: #1f6d19;
      border: 5px solid #10470d;
      border-radius: 7px;
      box-shadow: 0 7px 0 #6f6b61;
      color: #fff;
      font-size: 34px;
      font-weight: 900;
      height: 84px;
      margin-top: 18px;
      width: 100%;
    }
    .emptyState {
      font-size: 46px;
      font-weight: 900;
      margin-top: 36px;
    }
    .detailTitle {
      font-size: 56px;
      font-weight: 900;
      margin-top: 28px;
      text-align: center;
    }
    .detailTime {
      color: #245273;
      font-size: 50px;
      font-weight: 900;
      margin-top: 26px;
      text-align: center;
    }
    .doneButton {
      background: #1f6d19;
      border: 5px solid #10470d;
      border-radius: 7px;
      box-shadow: 0 7px 0 #6f6b61;
      color: #fff;
      font-size: 42px;
      font-weight: 900;
      height: 95px;
      margin-top: 42px;
      width: 100%;
    }
    .callTitle {
      font-size: 70px;
      font-weight: 900;
      margin-top: 65px;
      text-align: center;
    }
    .callSub {
      color: #5d6961;
      font-size: 34px;
      font-weight: 900;
      margin-top: 18px;
      text-align: center;
    }
    .sent {
      color: #5d6961;
      font-size: 32px;
      font-weight: 900;
      margin-top: 18px;
      text-align: center;
    }
    .miniStatus {
      color: #5d6961;
      font-size: 20px;
      font-weight: 900;
      margin-top: 8px;
      text-align: right;
    }
    .focusStrip {
      color: #101915;
      font-size: 22px;
      font-weight: 900;
      margin-top: 8px;
      min-height: 28px;
      overflow: hidden;
      text-align: center;
      white-space: nowrap;
    }
    .messageList {
      font-size: 32px;
      font-weight: 900;
      line-height: 1.2;
      margin-top: 26px;
    }
    .messageItem {
      border-bottom: 2px solid #d4d9d2;
      padding: 14px 0;
    }
    @media (orientation: portrait) {
      body {
        overflow: auto;
      }
      .screen {
        min-height: 100%;
        overflow: auto;
        padding: 18px;
      }
      .homeTop,
      .topCell,
      .grid,
      .row,
      .cell {
        display: block;
        height: auto;
        width: 100%;
      }
      .topCell {
        margin-bottom: 14px;
        text-align: center;
      }
      .person,
      .miniStatus {
        text-align: center;
      }
      .grid {
        margin-top: 10px;
      }
      .cell {
        padding: 8px 0;
      }
      .bigButton {
        height: 104px;
      }
    }
  </style>
</head>
<body>
  <div class="screen screenActive" id="homeScreen">
    <div class="homeTop">
      <div class="topCell">
        <div class="time" id="time">--:--</div>
        <div class="date" id="date">--</div>
      </div>
      <div class="topCell">
        <button class="apptPill" data-screen="appointmentScreen">
          <div class="apptDay" id="homeAppointmentDay">${escapeHtml(appointmentDay)}</div>
          <div class="apptTitle" id="homeAppointmentTitle">${escapeHtml(appointmentTitle)}</div>
          <div class="apptTime" id="homeAppointmentTime">${escapeHtml(appointmentTime)}</div>
        </button>
        <div class="focusStrip" id="focusStrip">Loading Today&apos;s Focus...</div>
      </div>
      <div class="topCell person">
        <div class="greeting" id="greeting">Good afternoon</div>
        <div class="name" id="receiverName">${escapeHtml(displayName)}</div>
        <div class="room" id="receiverLocation">${escapeHtml(locationLabel)}</div>
        <div class="miniStatus" id="connectionStatus">Starting...</div>
      </div>
    </div>
    <div class="grid">
      <div class="row">
        <div class="cell"><button class="bigButton" data-screen="askScreen">Ask a Question</button></div>
        <div class="cell"><button class="bigButton" data-screen="callScreen">Andrew</button></div>
      </div>
      <div class="row">
        <div class="cell"><button class="bigButton blue" data-screen="appointmentScreen">Appointment</button></div>
        <div class="cell"><button class="bigButton blue" data-screen="messagesScreen">Messages</button></div>
      </div>
    </div>
  </div>

  <div class="screen" id="askScreen">
    <div class="toolbar">
      <div class="toolbarTitle">Ask a question</div>
      <div class="toolbarAction"><button class="homeButton" data-screen="homeScreen">Go Home</button></div>
    </div>
    <div class="panelBody">
      <div class="whiteCard">
        <textarea class="questionInput" id="questionInput">Example: I need milk</textarea>
        <div class="quickGrid">
          <div class="quickRow">
            <div class="quickCell"><button class="quickButton" data-question="What time am I leaving?">What time am I leaving?</button></div>
            <div class="quickCell"><button class="quickButton" data-question="What should I bring?">What should I bring?</button></div>
          </div>
          <div class="quickRow">
            <div class="quickCell"><button class="quickButton" data-question="I need milk">I need milk</button></div>
            <div class="quickCell"><button class="quickButton" data-question="I feel dizzy">I feel dizzy</button></div>
          </div>
        </div>
        <button class="sendButton" id="sendQuestionButton">Send to Andrew</button>
        <div class="sent" id="askStatus"></div>
      </div>
    </div>
  </div>

  <div class="screen" id="callScreen">
    <div class="toolbar">
      <div class="toolbarTitle">Andrew</div>
      <div class="toolbarAction"><button class="homeButton" data-screen="homeScreen">Go Home</button></div>
    </div>
    <div class="panelBody">
      <div class="whiteCard">
        <div class="callTitle">Calling Andrew</div>
        <div class="callSub">Use the handset or speaker.</div>
        <button class="doneButton" data-screen="homeScreen">Close Call</button>
      </div>
    </div>
  </div>

  <div class="screen" id="appointmentScreen">
    <div class="toolbar">
      <div class="toolbarTitle">Appointment</div>
      <div class="toolbarAction"><button class="homeButton" data-screen="homeScreen">Go Home</button></div>
    </div>
    <div class="panelBody">
      <div class="whiteCard">
        <div class="detailTitle" id="appointmentDetailTitle">${escapeHtml(appointmentTitle)}</div>
        <div class="detailTime" id="appointmentDetailTime">${escapeHtml(appointmentDay)} &bull; ${escapeHtml(appointmentTime)}</div>
        <div class="sent" id="appointmentDetailMeta"></div>
        <button class="doneButton" data-screen="homeScreen">Done</button>
      </div>
    </div>
  </div>

  <div class="screen" id="messagesScreen">
    <div class="toolbar">
      <div class="toolbarTitle">Messages</div>
      <div class="toolbarAction"><button class="homeButton" data-screen="homeScreen">Go Home</button></div>
    </div>
    <div class="panelBody">
      <div class="whiteCard">
        <div class="emptyState" id="messagesEmpty">Loading messages...</div>
        <div class="messageList" id="messageList"></div>
        <div class="detailTime" id="messagesPager">&lt; &nbsp; 1 / 1 &nbsp; &gt;</div>
      </div>
    </div>
  </div>

  <script>
    (function () {
      var receiverState = {
        receiverDeviceId: "",
        receiverInstallId: "",
        personId: "",
        online: false
      };

      function pad(value) {
        return value < 10 ? "0" + value : "" + value;
      }
      function text(value) {
        return value === null || value === undefined ? "" : String(value);
      }
      function setText(id, value) {
        var element = document.getElementById(id);
        if (element) element.innerHTML = escapeHtml(text(value));
      }
      function setHtml(id, value) {
        var element = document.getElementById(id);
        if (element) element.innerHTML = value;
      }
      function escapeHtml(value) {
        return text(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }
      function jsonRequest(method, url, body, callback) {
        try {
          var request = new XMLHttpRequest();
          request.open(method, url, true);
          request.setRequestHeader("Accept", "application/json");
          if (receiverState.receiverDeviceId) {
            request.setRequestHeader("x-carepland-receiver-device-id", receiverState.receiverDeviceId);
          }
          if (receiverState.receiverInstallId) {
            request.setRequestHeader("x-carepland-receiver-install-id", receiverState.receiverInstallId);
          }
          if (body) {
            request.setRequestHeader("Content-Type", "application/json");
          }
          request.onreadystatechange = function () {
            if (request.readyState !== 4) return;
            var payload = {};
            try {
              payload = JSON.parse(request.responseText || "{}");
            } catch (error) {}
            callback(request.status, payload);
          };
          request.send(body ? JSON.stringify(body) : null);
        } catch (error) {
          callback(0, { error: "Connection failed." });
        }
      }
      function updateClock() {
        var now = new Date();
        var hours = now.getHours();
        var suffix = hours >= 12 ? "PM" : "AM";
        var displayHour = hours % 12;
        var greeting = "Good morning";
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        if (displayHour === 0) displayHour = 12;
        if (hours >= 12 && hours < 17) greeting = "Good afternoon";
        if (hours >= 17) greeting = "Good evening";
        document.getElementById("time").innerHTML = displayHour + ":" + pad(now.getMinutes()) + " " + suffix;
        document.getElementById("date").innerHTML = months[now.getMonth()] + " " + now.getDate();
        document.getElementById("greeting").innerHTML = greeting;
      }
      function showScreen(id) {
        var screens = document.getElementsByClassName("screen");
        var i;
        for (i = 0; i < screens.length; i += 1) {
          screens[i].className = screens[i].className.replace(" screenActive", "");
        }
        document.getElementById(id).className += " screenActive";
      }
      function bindButtons() {
        var buttons = document.getElementsByTagName("button");
        var i;
        for (i = 0; i < buttons.length; i += 1) {
          buttons[i].onclick = function () {
            var target = this.getAttribute("data-screen");
            var question = this.getAttribute("data-question");
            if (question) {
              document.getElementById("questionInput").value = question;
              document.getElementById("askStatus").innerHTML = "";
            }
            if (target) showScreen(target);
          };
        }
        document.getElementById("sendQuestionButton").onclick = function () {
          sendQuestion();
        };
      }
      function readNativeConfig() {
        try {
          if (!window.CarePlandReceiver || !window.CarePlandReceiver.getProvisioningJson) {
            return null;
          }
          return JSON.parse(window.CarePlandReceiver.getProvisioningJson());
        } catch (error) {
          return null;
        }
      }
      function postNativeBinding(config, callback) {
        if (!config || !config.receiverDeviceId || !config.receiverInstallId) {
          setText("connectionStatus", "Setup needed");
          if (callback) callback(null);
          return;
        }
        receiverState.receiverDeviceId = config.receiverDeviceId;
        receiverState.receiverInstallId = config.receiverInstallId;
        try {
          jsonRequest("POST", "/api/connect/receiver-shell/devices/binding", {
            capabilities: config.capabilities || {},
            deviceOwner: config.deviceOwner,
            lastRecoveryAction: config.lastRecoveryAction,
            lastRecoveryAtMs: config.lastRecoveryAtMs,
            lockTaskActive: config.lockTaskActive,
            lockTaskPermitted: config.lockTaskPermitted,
            nativeManufacturer: config.manufacturer,
            nativeModel: config.model,
            nativeSdk: config.sdkVersion,
            nativeVersionCode: config.versionCode,
            nativeVersionName: config.versionName,
            provisioningCompletedAtMs: config.provisioningCompletedAtMs,
            receiverDeviceId: config.receiverDeviceId,
            receiverInstallId: config.receiverInstallId,
            receiverMode: config.receiverMode,
            shellVersion: config.shellVersion
          }, function (status, payload) {
            if (status >= 200 && status < 300 && payload && payload.ok !== false) {
              receiverState.online = true;
              receiverState.personId = payload.mainConnectUserPersonId || receiverState.personId;
              setText("connectionStatus", "Online");
              if (callback) callback(payload);
              return;
            }
            receiverState.online = false;
            setText("connectionStatus", "Setup needed");
            if (window.CarePlandReceiver && window.CarePlandReceiver.receiverSetupRequired) {
              window.CarePlandReceiver.receiverSetupRequired(payload.error || "Receiver setup is required.");
            }
            if (callback) callback(null);
          });
        } catch (error) {
          setText("connectionStatus", "Offline");
        }
      }
      function formatAppointmentDate(value) {
        if (!value) return "";
        try {
          var date = new Date(value);
          var now = new Date();
          var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          var sameTomorrow =
            date.getFullYear() === tomorrow.getFullYear() &&
            date.getMonth() === tomorrow.getMonth() &&
            date.getDate() === tomorrow.getDate();
          if (sameTomorrow) return "Tomorrow";
          return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()] + ", " +
            ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()] +
            " " + date.getDate();
        } catch (error) {
          return "";
        }
      }
      function formatAppointmentTime(value) {
        if (!value) return "";
        try {
          var date = new Date(value);
          var hours = date.getHours();
          var minutes = date.getMinutes();
          var suffix = hours >= 12 ? "PM" : "AM";
          var displayHour = hours % 12;
          if (displayHour === 0) displayHour = 12;
          return displayHour + (minutes ? ":" + pad(minutes) : "") + " " + suffix;
        } catch (error) {
          return "";
        }
      }
      function loadAppointments() {
        if (!receiverState.personId) return;
        jsonRequest(
          "GET",
          "/api/connect/appointments?personId=" + encodeURIComponent(receiverState.personId),
          null,
          function (status, payload) {
            var appointments = payload && payload.appointments && payload.appointments.length
              ? payload.appointments
              : [];
            if (!appointments.length) {
              setText("homeAppointmentDay", "No appointment");
              setText("homeAppointmentTitle", "Nothing scheduled");
              setText("homeAppointmentTime", "");
              setText("appointmentDetailTitle", "No upcoming appointments");
              setText("appointmentDetailTime", "");
              setText("appointmentDetailMeta", "CarePland will show the next appointment here.");
              return;
            }
            var appt = appointments[0];
            var title = appt.title || appt.reason || "Appointment";
            var day = formatAppointmentDate(appt.startsAt);
            var time = formatAppointmentTime(appt.startsAt);
            setText("homeAppointmentDay", day || "Upcoming");
            setText("homeAppointmentTitle", title);
            setText("homeAppointmentTime", time);
            setText("appointmentDetailTitle", title);
            setHtml("appointmentDetailTime", escapeHtml(day || "Upcoming") + " &bull; " + escapeHtml(time));
            setText("appointmentDetailMeta", appt.providerName || appt.providerOrganization || "");
          }
        );
      }
      function loadTodayFocus() {
        if (!receiverState.personId) return;
        jsonRequest(
          "GET",
          "/api/connect/today-focus?personId=" + encodeURIComponent(receiverState.personId),
          null,
          function (status, payload) {
            var items = payload && payload.focusItems && payload.focusItems.length
              ? payload.focusItems
              : [];
            if (!items.length) {
              setText("focusStrip", "Today's Focus: nothing due");
              return;
            }
            setText("focusStrip", "Today's Focus: " + items[0].title);
          }
        );
      }
      function loadMessages() {
        if (!receiverState.personId) return;
        jsonRequest(
          "GET",
          "/api/connect/messages?personId=" + encodeURIComponent(receiverState.personId),
          null,
          function (status, payload) {
            var messages = payload && payload.messages && payload.messages.length
              ? payload.messages
              : [];
            var html = "";
            var i;
            if (!messages.length) {
              setText("messagesEmpty", "No messages yet.");
              setHtml("messageList", "");
              setHtml("messagesPager", "&lt; &nbsp; 1 / 1 &nbsp; &gt;");
              return;
            }
            setText("messagesEmpty", "");
            for (i = 0; i < messages.length && i < 4; i += 1) {
              html += '<div class="messageItem">' + escapeHtml(messages[i].body || messages[i].transcript || "Message") + "</div>";
            }
            setHtml("messageList", html);
            setText("messagesPager", "1 / " + Math.max(1, messages.length));
          }
        );
      }
      function sendQuestion() {
        var input = document.getElementById("questionInput");
        var body = input ? input.value.replace(/^\\s+|\\s+$/g, "") : "";
        if (!body || body === "Example: I need milk") {
          setText("askStatus", "Type or tap a question first.");
          return;
        }
        if (!receiverState.personId) {
          setText("askStatus", "Receiver is still connecting.");
          return;
        }
        setText("askStatus", "Sending...");
        jsonRequest("POST", "/api/connect/messages", {
          body: body,
          clientMessageId: "classic-webview-receiver-text-" + new Date().getTime(),
          from: "receiver_user",
          mainConnectUserPersonId: receiverState.personId,
          messageType: "text",
          receiverDeviceId: receiverState.receiverDeviceId,
          receiverId: receiverState.receiverDeviceId || "classic-webview-receiver",
          receiverInstallId: receiverState.receiverInstallId,
          source: "classic_webview_receiver_ask",
          to: "Andrew"
        }, function (status, payload) {
          if (status >= 200 && status < 300 && payload && payload.ok !== false) {
            setText("askStatus", "Sent to Andrew.");
            loadMessages();
            return;
          }
          setText("askStatus", payload.error || "Could not send yet.");
        });
      }
      function markReady() {
        try {
          if (window.CarePlandReceiver && window.CarePlandReceiver.receiverReady) {
            window.CarePlandReceiver.receiverReady();
          }
        } catch (error) {}
      }
      updateClock();
      bindButtons();
      window.setInterval(updateClock, 30000);
      postNativeBinding(readNativeConfig(), function () {
        loadAppointments();
        loadTodayFocus();
        loadMessages();
      });
      window.setInterval(function () {
        postNativeBinding(readNativeConfig(), function () {
          loadAppointments();
          loadTodayFocus();
          loadMessages();
        });
      }, 60000);
      markReady();
    }());
  </script>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
