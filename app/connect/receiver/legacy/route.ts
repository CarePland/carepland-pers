import type { NextRequest } from "next/server";

import {
  createReceiverRuntimeContract,
  type ReceiverRuntimeContract,
} from "../../../lib/connect/receiver/receiverRuntimeContract";
import { classicReceiverRuntimeInput } from "../../../lib/connect/receiver/classicWebviewReceiverRoute";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const runtimeContract = createReceiverRuntimeContract(
    classicReceiverRuntimeInput(searchParams)
  );
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
      runtimeContract,
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
  runtimeContract,
}: {
  appointmentDay: string;
  appointmentTime: string;
  appointmentTitle: string;
  displayName: string;
  locationLabel: string;
  runtimeContract: ReceiverRuntimeContract;
}) {
  const schemaClass = safeCssClass(`schema-${runtimeContract.layout.uiSchemaId}`);
  const scaleClass = safeCssClass(`scale-${runtimeContract.layout.scaleMode}`);
  const viewportWidth = runtimeContract.hardware.displayWidthPx || runtimeContract.hardware.displayWidthDp || 1024;
  const viewportHeight = runtimeContract.hardware.displayHeightPx || runtimeContract.hardware.displayHeightDp || 600;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>CarePland Receiver</title>
  <style>
    :root {
      --receiver-design-width: ${runtimeContract.layout.uiSchemaId === "gxv3370_classic_1024x600_v1" ? "1024" : viewportWidth};
      --receiver-design-height: ${runtimeContract.layout.uiSchemaId === "gxv3370_classic_1024x600_v1" ? "600" : viewportHeight};
      --receiver-actual-width: ${viewportWidth};
      --receiver-actual-height: ${viewportHeight};
      --receiver-min-touch-target: ${runtimeContract.layout.uiSchemaId === "gxv3370_classic_1024x600_v1" ? "72px" : "56px"};
    }
    html, body {
      background: #171a18;
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
    .receiverFrame {
      background: #e3e7e1;
      height: 600px;
      left: 0;
      overflow: hidden;
      position: absolute;
      top: 0;
      transform-origin: top left;
      width: 1024px;
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
    .receiverHome {
      bottom: 0;
      left: 0;
      position: absolute;
      right: 0;
      top: 0;
    }
    .homeLeftPane {
      bottom: 96px;
      left: 28px;
      position: absolute;
      top: 18px;
      width: 565px;
    }
    .homeRightPane {
      bottom: 96px;
      left: 615px;
      position: absolute;
      right: 24px;
      top: 18px;
    }
    .focusPanel {
      box-sizing: border-box;
      height: 155px;
      padding: 2px 18px 0;
      position: relative;
    }
    .focusPanel h1 {
      font-size: 30px;
      font-weight: 900;
      line-height: 1;
      margin: 0 0 13px;
    }
    .focusItem {
      box-sizing: border-box;
      color: #101915;
      font-size: 27px;
      font-weight: 900;
      line-height: 1.1;
      margin: 10px 0;
      min-height: 34px;
      overflow: hidden;
      padding-left: 46px;
      position: relative;
      white-space: nowrap;
    }
    .focusItem:before {
      border: 4px solid #6b746c;
      border-radius: 5px;
      box-sizing: border-box;
      content: "";
      height: 26px;
      left: 0;
      position: absolute;
      top: 1px;
      width: 26px;
    }
    .focusItemSecondary,
    .focusItemTertiary {
      display: none;
    }
    .homeAppointmentButton {
      background: #fbfaf5;
      border: 4px solid #9aa39c;
      border-radius: 8px;
      box-shadow: 0 7px 0 #8a867c;
      box-sizing: border-box;
      color: #101915;
      display: block;
      font-size: 32px;
      font-weight: 900;
      height: 108px;
      line-height: 1.08;
      margin: 8px 0 18px;
      overflow: hidden;
      padding: 0 22px;
      text-align: left;
      white-space: nowrap;
      width: 100%;
    }
    .homeAppointmentDay,
    .homeAppointmentTime {
      color: #5d6961;
    }
    .homeTalkButton {
      background: #101211;
      border: 5px solid #2d3430;
      border-radius: 8px;
      box-shadow: 0 8px 0 #6f6b61;
      box-sizing: border-box;
      color: #ffffff;
      display: table;
      height: 190px;
      width: 100%;
    }
    .talkIconCell,
    .talkLabelCell {
      display: table-cell;
      text-align: center;
      vertical-align: middle;
    }
    .talkIconCell {
      width: 220px;
    }
    .talkIcon {
      background: #ff4148;
      border-radius: 50%;
      color: #ffffff;
      display: inline-block;
      font-size: 74px;
      height: 112px;
      line-height: 112px;
      width: 112px;
    }
    .talkLabelCell {
      font-size: 58px;
      font-weight: 900;
      line-height: 1;
      text-align: left;
    }
    .homeActionButton {
      background: #1f6d19;
      border: 5px solid #10470d;
      border-radius: 7px;
      box-shadow: 0 8px 0 #6f6b61;
      box-sizing: border-box;
      color: #ffffff;
      display: block;
      font-size: 36px;
      font-weight: 900;
      height: 113px;
      line-height: 1.05;
      margin-bottom: 16px;
      text-align: center;
      width: 100%;
    }
    .homeActionButton.blue {
      background: #326894;
      border-color: #1d4c73;
    }
    .receiverFooter {
      bottom: 12px;
      box-sizing: border-box;
      display: table;
      height: 76px;
      left: 28px;
      position: absolute;
      right: 24px;
      table-layout: fixed;
    }
    .footerLogo,
    .footerGreeting,
    .footerClock,
    .footerDate,
    .footerButtonCell {
      display: table-cell;
      vertical-align: middle;
    }
    .footerLogo {
      width: 66px;
    }
    .cpLogo {
      background: #3f8aca;
      border-radius: 50%;
      color: #ffffff;
      display: inline-block;
      font-size: 34px;
      font-weight: 900;
      height: 52px;
      line-height: 52px;
      text-align: center;
      width: 52px;
    }
    .footerGreeting {
      color: #5d6961;
      font-size: 27px;
      font-weight: 900;
      overflow: hidden;
      white-space: nowrap;
      width: 420px;
    }
    .footerGreeting .name {
      color: #101915;
      display: inline;
      font-size: 31px;
      line-height: 1;
      margin-left: 18px;
    }
    .footerClock {
      color: #101915;
      font-size: 56px;
      font-weight: 900;
      line-height: 1;
      text-align: right;
      white-space: nowrap;
      width: 245px;
    }
    .footerDate {
      color: #5d6961;
      font-size: 29px;
      font-weight: 900;
      line-height: 1;
      padding-left: 16px;
      white-space: nowrap;
      width: 76px;
    }
    .footerButtonCell {
      padding-left: 14px;
      width: 120px;
    }
    .footerButton {
      background: #fbfaf5;
      border: 4px solid #6f766f;
      border-radius: 7px;
      box-shadow: 0 7px 0 #8a867c;
      box-sizing: border-box;
      color: #101915;
      font-size: 24px;
      font-weight: 900;
      height: 64px;
      width: 112px;
    }
    .setupPanel {
      box-sizing: border-box;
      height: 100%;
      padding: 38px 56px;
      text-align: center;
    }
    .setupCard {
      background: #fbfaf5;
      border: 5px solid #17231d;
      border-radius: 8px;
      box-sizing: border-box;
      height: 100%;
      padding: 34px 42px;
    }
    .setupBrand {
      color: #5d6961;
      font-size: 24px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .setupTitle {
      font-size: 58px;
      font-weight: 900;
      line-height: 1;
      margin-top: 10px;
    }
    .setupSub {
      color: #5d6961;
      font-size: 28px;
      font-weight: 900;
      margin-top: 12px;
    }
    .pairingCode {
      background: white;
      border: 5px solid #17231d;
      border-radius: 8px;
      color: #17231d;
      font-size: 86px;
      font-weight: 900;
      line-height: 1;
      margin: 28px auto 18px;
      max-width: 600px;
      padding: 22px 24px;
    }
    .setupHelp {
      color: #17231d;
      font-size: 25px;
      font-weight: 900;
      line-height: 1.22;
      margin: 14px auto 0;
      max-width: 720px;
    }
    .setupStatus {
      color: #5d6961;
      font-size: 22px;
      font-weight: 900;
      margin-top: 18px;
    }
    .setupButton {
      background: #26661a;
      border: 4px solid #17440f;
      border-radius: 8px;
      color: white;
      font-size: 30px;
      font-weight: 900;
      margin-top: 20px;
      min-height: 64px;
      padding: 10px 32px;
    }
    .bootCard {
      display: grid;
      align-content: center;
      gap: 16px;
    }
    .bootStatus {
      color: #5d6961;
      font-size: 30px;
      font-weight: 900;
      line-height: 1.15;
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
    .${schemaClass} .bigButton,
    .${schemaClass} .homeButton,
    .${schemaClass} .quickButton,
    .${schemaClass} .sendButton,
    .${schemaClass} .doneButton {
      min-height: var(--receiver-min-touch-target);
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
      position: absolute;
      right: 26px;
      text-align: right;
      top: 570px;
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
    .fullscreenPrompt {
      background: #17231d;
      border: 4px solid #fbfaf5;
      border-radius: 8px;
      bottom: 18px;
      box-shadow: 0 7px 0 rgba(70, 64, 56, 0.65);
      color: #ffffff;
      display: none;
      font-size: 27px;
      font-weight: 900;
      min-height: 70px;
      min-width: 210px;
      padding: 12px 24px;
      position: fixed;
      right: 18px;
      z-index: 20;
    }
    .browserReceiverControls .fullscreenPromptVisible {
      display: block;
    }
    .fullscreenPrompt:active {
      box-shadow: 0 2px 0 rgba(70, 64, 56, 0.65);
      transform: translateY(5px);
    }
    .layoutMenuWrap {
      display: none;
      position: fixed;
      right: 18px;
      top: 18px;
      z-index: 21;
    }
    .browserReceiverControls .layoutMenuWrap {
      display: block;
    }
    .layoutButton {
      background: #fbfaf5;
      border: 3px solid #17231d;
      border-radius: 7px;
      box-shadow: 0 5px 0 rgba(70, 64, 56, 0.65);
      color: #17231d;
      font-size: 22px;
      font-weight: 900;
      min-height: 54px;
      min-width: 126px;
      padding: 8px 14px;
    }
    .layoutButton:active {
      box-shadow: 0 1px 0 rgba(70, 64, 56, 0.65);
      transform: translateY(4px);
    }
    .layoutMenu {
      background: #fbfaf5;
      border: 3px solid #17231d;
      border-radius: 7px;
      box-shadow: 0 7px 0 rgba(70, 64, 56, 0.5);
      display: none;
      gap: 7px;
      margin-top: 10px;
      padding: 9px;
      width: 190px;
    }
    .layoutMenuOpen {
      display: grid;
    }
    .layoutMenu button {
      background: #f1f3ee;
      border: 3px solid #aeb6b0;
      border-radius: 6px;
      color: #17231d;
      font-size: 22px;
      font-weight: 900;
      min-height: 54px;
      text-align: left;
      padding: 8px 12px;
    }
    .layoutMenu button.activeLayout {
      background: #26661a;
      border-color: #17440f;
      color: #ffffff;
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
      .fullscreenPrompt {
        bottom: 10px;
        font-size: 24px;
        min-height: 62px;
        min-width: 180px;
        right: 10px;
      }
      .layoutMenuWrap {
        right: 10px;
        top: 10px;
      }
    }
  </style>
</head>
<body class="${schemaClass} ${scaleClass}" data-ui-schema-id="${escapeHtml(
    runtimeContract.layout.uiSchemaId
  )}" data-ui-schema-version="${runtimeContract.layout.uiSchemaVersion}" data-ui-layout="${escapeHtml(
    runtimeContract.layout.uiLayout
  )}" data-scale-mode="${escapeHtml(runtimeContract.layout.scaleMode)}" data-hardware-profile="${escapeHtml(
    runtimeContract.hardware.hardwareProfile
  )}" data-screen-class="${escapeHtml(runtimeContract.hardware.screenClass)}">
  <div class="receiverFrame" id="receiverFrame">
  <div class="screen screenActive" id="bootScreen">
    <div class="setupPanel">
      <div class="setupCard bootCard">
        <div class="setupBrand">CarePland Connect</div>
        <div class="setupTitle">Receiver</div>
        <div class="bootStatus">Starting Receiver...</div>
      </div>
    </div>
  </div>

  <div class="screen" id="setupScreen">
    <div class="setupPanel">
      <div class="setupCard">
        <div class="setupBrand">CarePland Connect</div>
        <div class="setupTitle">Set Up Receiver</div>
        <div class="setupSub">Pair this Receiver from Connect</div>
        <div class="pairingCode" id="pairingCode">---</div>
        <div class="setupHelp">
          Open CarePland Connect in a browser, go to Receiver, choose Pair Receiver,
          and enter this code.
        </div>
        <div class="setupStatus" id="setupStatus">Preparing Receiver setup...</div>
        <button class="setupButton" id="newPairingCodeButton">New Code</button>
      </div>
    </div>
  </div>

  <div class="screen" id="homeScreen">
    <div class="receiverHome">
      <div class="homeLeftPane">
        <div class="focusPanel">
          <h1>Today&apos;s Focus</h1>
          <div class="focusItem" id="focusStrip">Loading Today&apos;s Focus...</div>
          <div class="focusItem focusItemSecondary" id="focusStripSecond"></div>
          <div class="focusItem focusItemTertiary" id="focusStripThird"></div>
        </div>
        <button class="homeAppointmentButton" data-screen="appointmentScreen">
          <span class="homeAppointmentDay" id="homeAppointmentDay">${escapeHtml(appointmentDay)}</span>
          <span class="homeAppointmentTime" id="homeAppointmentTime">${escapeHtml(appointmentTime)}</span><span>: </span>
          <span id="homeAppointmentTitle">${escapeHtml(appointmentTitle)}</span>
        </button>
        <button class="homeTalkButton" data-screen="askScreen">
          <span class="talkIconCell"><span class="talkIcon">♪</span></span>
          <span class="talkLabelCell">Talk</span>
        </button>
      </div>
      <div class="homeRightPane">
        <button class="homeActionButton blue" data-screen="messagesScreen">Messages</button>
        <button class="homeActionButton blue" data-screen="appointmentScreen">Appointment</button>
        <button class="homeActionButton" data-screen="askScreen">Ask a Question</button>
        <button class="homeActionButton" data-screen="callScreen">Call Andrew</button>
      </div>
      <div class="receiverFooter">
        <div class="footerLogo"><span class="cpLogo">CP</span></div>
        <div class="footerGreeting"><span id="greeting">Good afternoon</span><span class="name" id="receiverName">${escapeHtml(displayName)}</span></div>
        <div class="footerClock" id="time">--:--</div>
        <div class="footerDate"><span id="date">--</span></div>
        <div class="footerButtonCell"><button class="footerButton" type="button">Sounds</button></div>
        <div class="footerButtonCell"><button class="footerButton" type="button">Clean</button></div>
      </div>
      <div class="miniStatus" id="connectionStatus">Starting...</div>
      <div id="receiverLocation" style="display:none">${escapeHtml(locationLabel)}</div>
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
  </div>

  <button class="fullscreenPrompt" id="fullscreenPrompt" type="button">Fill Screen</button>
  <div class="layoutMenuWrap">
    <button class="layoutButton" id="layoutButton" type="button" aria-haspopup="menu" aria-expanded="false">LAYOUT</button>
    <div class="layoutMenu" id="layoutMenu" role="menu" aria-label="Receiver layout">
      <button class="activeLayout" type="button" role="menuitemradio" aria-checked="true" data-layout-choice="old">Old Web</button>
      <button type="button" role="menuitemradio" aria-checked="false" data-layout-choice="classic">Classic</button>
      <button type="button" role="menuitemradio" aria-checked="false" data-layout-choice="focus">Focus</button>
    </div>
  </div>

  <script>
    (function () {
      var receiverState = {
        receiverDeviceId: "",
        receiverInstallId: "",
        pairingCode: "",
        pairingDeviceId: "",
        personId: "",
        online: false
      };
      var browserBindingStorageKey = "carepland-connect-receiver-binding";
      var browserInstallStorageKey = "carepland-connect-classic-receiver-install-id";
      var pairingPollTimer = null;

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
        applyReceiverFrameScale();
        updateFullscreenPrompt();
      }
      function applyReceiverFrameScale() {
        var frame = document.getElementById("receiverFrame");
        if (!frame) return;
        var designWidth = 1024;
        var designHeight = 600;
        var availableWidth = window.innerWidth || document.documentElement.clientWidth || designWidth;
        var availableHeight = window.innerHeight || document.documentElement.clientHeight || designHeight;
        var scale = Math.min(availableWidth / designWidth, availableHeight / designHeight);
        if (!scale || scale <= 0) scale = 1;
        var left = Math.max(0, (availableWidth - designWidth * scale) / 2);
        var top = Math.max(0, (availableHeight - designHeight * scale) / 2);
        frame.style.width = designWidth + "px";
        frame.style.height = designHeight + "px";
        frame.style.left = left + "px";
        frame.style.top = top + "px";
        frame.style.transform = "scale(" + scale + ")";
      }
      function fullscreenElement() {
        return document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement ||
          null;
      }
      function fullscreenRequestMethod(element) {
        return element.requestFullscreen ||
          element.webkitRequestFullscreen ||
          element.mozRequestFullScreen ||
          element.msRequestFullscreen ||
          null;
      }
      function nativeReceiverShellPresent() {
        return Boolean(
          window.CarePlandReceiver &&
          (
            window.CarePlandReceiver.getProvisioningJson ||
            window.CarePlandReceiver.saveBinding ||
            window.CarePlandReceiver.receiverReady
          )
        );
      }
      function updateReceiverChromeControls() {
        if (nativeReceiverShellPresent()) {
          document.body.className = document.body.className.replace(" browserReceiverControls", "");
          document.body.className = document.body.className.indexOf("nativeReceiverShell") >= 0
            ? document.body.className
            : document.body.className + " nativeReceiverShell";
          setLayoutMenuOpen(false);
          return;
        }
        document.body.className = document.body.className.replace(" nativeReceiverShell", "");
        if (document.body.className.indexOf("browserReceiverControls") < 0) {
          document.body.className += " browserReceiverControls";
        }
      }
      function fullscreenPromptAllowed() {
        return !nativeReceiverShellPresent() && Boolean(fullscreenRequestMethod(document.documentElement));
      }
      function updateFullscreenPrompt(message) {
        updateReceiverChromeControls();
        var prompt = document.getElementById("fullscreenPrompt");
        if (!prompt) return;
        if (message) prompt.innerHTML = escapeHtml(message);
        if (!fullscreenPromptAllowed() || fullscreenElement()) {
          prompt.className = "fullscreenPrompt";
          return;
        }
        prompt.className = "fullscreenPrompt fullscreenPromptVisible";
      }
      function requestReceiverFullscreen() {
        var prompt = document.getElementById("fullscreenPrompt");
        var element = document.documentElement;
        var request = fullscreenRequestMethod(element);
        if (!request) {
          if (prompt) prompt.innerHTML = "Use Chrome Menu";
          return;
        }
        try {
          var result = request.call(element);
          if (result && result.then) {
            result.then(function () {
              updateFullscreenPrompt();
            }).catch(function () {
              if (prompt) prompt.innerHTML = "Use Chrome Menu";
            });
          } else {
            updateFullscreenPrompt();
          }
        } catch (error) {
          if (prompt) prompt.innerHTML = "Use Chrome Menu";
        }
      }
      function setLayoutMenuOpen(open) {
        var menu = document.getElementById("layoutMenu");
        var button = document.getElementById("layoutButton");
        if (!menu || !button) return;
        if (nativeReceiverShellPresent()) open = false;
        menu.className = open ? "layoutMenu layoutMenuOpen" : "layoutMenu";
        button.setAttribute("aria-expanded", open ? "true" : "false");
      }
      function modernReceiverUrl(homeLayout) {
        var url = new URL("/connect/receiver", window.location.origin);
        url.searchParams.set("receiver_runtime", "modern_web");
        url.searchParams.set("device", "gxv3370");
        url.searchParams.set("hardwareProfile", "grandstream_gxv3370");
        url.searchParams.set("uiLayout", "desk_phone_1024x600");
        if (homeLayout) url.searchParams.set("homeLayout", homeLayout);
        return url.toString();
      }
      function chooseReceiverLayout(choice) {
        setLayoutMenuOpen(false);
        if (nativeReceiverShellPresent()) return;
        if (choice === "classic") {
          window.location.assign(modernReceiverUrl(""));
          return;
        }
        if (choice === "focus") {
          window.location.assign(modernReceiverUrl("focus_v1"));
        }
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
        document.getElementById("fullscreenPrompt").onclick = function () {
          requestReceiverFullscreen();
        };
        document.getElementById("layoutButton").onclick = function () {
          var menu = document.getElementById("layoutMenu");
          setLayoutMenuOpen(!menu || menu.className.indexOf("layoutMenuOpen") < 0);
        };
        var layoutChoices = document.querySelectorAll("[data-layout-choice]");
        for (i = 0; i < layoutChoices.length; i += 1) {
          layoutChoices[i].onclick = function () {
            chooseReceiverLayout(this.getAttribute("data-layout-choice"));
          };
        }
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
      function readStoredBinding() {
        try {
          var raw = window.localStorage ? window.localStorage.getItem(browserBindingStorageKey) : "";
          if (!raw) return null;
          var parsed = JSON.parse(raw);
          return parsed && typeof parsed === "object" ? parsed : null;
        } catch (error) {
          return null;
        }
      }
      function writeStoredBinding(payload) {
        if (!payload || !payload.receiverDeviceId) return;
        try {
          if (window.localStorage) {
            window.localStorage.setItem(browserBindingStorageKey, JSON.stringify({
              bindingStatus: payload.bindingStatus || "bound",
              deviceProfile: payload.deviceProfile || "",
              hardwareProfile: payload.hardwareProfile || "",
              mainConnectUserPersonId: payload.mainConnectUserPersonId || "",
              receiverDeviceId: payload.receiverDeviceId || "",
              receiverInstallId: payload.receiverInstallId || receiverState.receiverInstallId || "",
              receiverUrl: payload.receiverUrl || "",
              storageSource: payload.storageSource || "",
              uiLayout: payload.uiLayout || ""
            }));
          }
        } catch (error) {}
      }
      function readOrCreateInstallId(config) {
        var stored = readStoredBinding();
        var existing =
          (config && config.receiverInstallId) ||
          (stored && stored.receiverInstallId) ||
          "";
        if (existing) return existing;
        try {
          existing = window.localStorage ? window.localStorage.getItem(browserInstallStorageKey) : "";
          if (existing) return existing;
          existing = "classic-web-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000000);
          if (window.localStorage) window.localStorage.setItem(browserInstallStorageKey, existing);
          return existing;
        } catch (error) {
          return "classic-web-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000000);
        }
      }
      function mergedReceiverConfig(config) {
        var stored = readStoredBinding();
        var next = {};
        var key;
        if (stored) {
          for (key in stored) {
            if (Object.prototype.hasOwnProperty.call(stored, key)) next[key] = stored[key];
          }
        }
        if (config) {
          for (key in config) {
            if (Object.prototype.hasOwnProperty.call(config, key) && config[key] !== undefined && config[key] !== null && config[key] !== "") {
              next[key] = config[key];
            }
          }
        }
        return next;
      }
      function formatPairingCode(value) {
        var digits = text(value).replace(/\\D/g, "");
        if (digits.length === 6) return digits.substr(0, 3) + " " + digits.substr(3, 3);
        return text(value);
      }
      function receiverUrlForPairing() {
        return window.location.protocol + "//" + window.location.host + "/connect/receiver/legacy?receiver_runtime=classic_webview";
      }
      function showSetupStatus(message) {
        setText("setupStatus", message);
        setText("connectionStatus", "Setup needed");
        setText("focusStrip", "Receiver setup is needed.");
      }
      function saveReceiverBindingPayload(payload) {
        if (!payload || !payload.receiverDeviceId) return;
        writeStoredBinding(payload);
        saveNativeBinding(payload);
        receiverState.receiverDeviceId = payload.receiverDeviceId || receiverState.receiverDeviceId;
        receiverState.receiverInstallId = payload.receiverInstallId || receiverState.receiverInstallId;
        receiverState.personId = payload.mainConnectUserPersonId || receiverState.personId;
      }
      function postNativeBinding(config, callback) {
        if (!config || !config.receiverDeviceId || !config.receiverInstallId) {
          startClassicPairing(callback);
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
            var errorMessage = payload && payload.error ? payload.error : "Receiver setup is required.";
            if (errorMessage.indexOf("not complete") >= 0) {
              setText("connectionStatus", "Pairing finishing");
              setText("focusStrip", "Receiver is connecting...");
            } else {
              setText("connectionStatus", "Setup needed");
              setText("focusStrip", "Receiver setup is needed.");
              if (window.CarePlandReceiver && window.CarePlandReceiver.receiverSetupRequired) {
                window.CarePlandReceiver.receiverSetupRequired(errorMessage);
              }
            }
            if (callback) callback(null);
          });
        } catch (error) {
          setText("connectionStatus", "Offline");
          setText("focusStrip", "Receiver is offline.");
        }
      }
      function saveNativeBinding(payload) {
        if (!payload || !payload.receiverDeviceId) return;
        try {
          if (window.CarePlandReceiver && window.CarePlandReceiver.saveBinding) {
            window.CarePlandReceiver.saveBinding(
              payload.receiverDeviceId || "",
              payload.bindingStatus || "bound",
              payload.deviceProfile || "",
              payload.hardwareProfile || "",
              payload.uiLayout || ""
            );
          }
        } catch (error) {}
      }
      function redeemNativeClaim(config, callback) {
        if (!config || !config.setupClaim || !config.receiverInstallId) {
          if (callback) callback(false);
          return;
        }
        setText("connectionStatus", "Pairing finishing");
        setText("focusStrip", "Receiver is connecting...");
        jsonRequest("POST", "/api/connect/receiver-shell/claims/redeem", {
          claim: config.setupClaim,
          receiverInstallId: config.receiverInstallId
        }, function (status, payload) {
          if (status >= 200 && status < 300 && payload && payload.ok !== false) {
            saveReceiverBindingPayload(payload);
            if (callback) callback(true);
            return;
          }
          if (callback) callback(false);
        });
      }
      function connectNativeReceiver(callback) {
        var config = mergedReceiverConfig(readNativeConfig());
        if (config && config.setupClaim) {
          redeemNativeClaim(config, function () {
            postNativeBinding(mergedReceiverConfig(readNativeConfig() || config), callback);
          });
          return;
        }
        postNativeBinding(config, callback);
      }
      function redeemClassicPairingClaim(claim, callback) {
        showSetupStatus("Receiver detected. Finishing setup...");
        jsonRequest("POST", "/api/connect/receiver-shell/claims/redeem", {
          claim: claim,
          receiverInstallId: receiverState.receiverInstallId
        }, function (status, payload) {
          if (status >= 200 && status < 300 && payload && payload.ok !== false) {
            saveReceiverBindingPayload(payload);
            showSetupStatus("Receiver ready.");
            showScreen("homeScreen");
            if (callback) callback(payload);
            return;
          }
          showSetupStatus(payload.error || "Receiver setup could not be completed.");
        });
      }
      function pollClassicPairing(callback) {
        if (!receiverState.pairingCode) return;
        var url = "/api/connect/receiver-shell/pairing-sessions?code=" + encodeURIComponent(receiverState.pairingCode);
        if (receiverState.pairingDeviceId) {
          url += "&receiverDeviceId=" + encodeURIComponent(receiverState.pairingDeviceId);
        }
        jsonRequest("GET", url, null, function (status, payload) {
          if (status >= 200 && status < 300 && payload && payload.ok !== false) {
            if (payload.status === "paired" && payload.claim) {
              redeemClassicPairingClaim(payload.claim, callback);
              return;
            }
            if (payload.status === "expired") {
              showSetupStatus("This code expired. Tap New Code.");
              return;
            }
            pairingPollTimer = window.setTimeout(function () {
              pollClassicPairing(callback);
            }, 2500);
            return;
          }
          showSetupStatus(payload.error || "Receiver pairing could not be checked.");
          pairingPollTimer = window.setTimeout(function () {
            pollClassicPairing(callback);
          }, 5000);
        });
      }
      function startClassicPairing(callback) {
        showScreen("setupScreen");
        receiverState.receiverInstallId = readOrCreateInstallId(readNativeConfig());
        if (pairingPollTimer) window.clearTimeout(pairingPollTimer);
        showSetupStatus("Preparing Receiver setup...");
        jsonRequest("POST", "/api/connect/receiver-shell/pairing-sessions", {
          deviceProfile: "classic_webview",
          hardwareProfile: document.body.getAttribute("data-hardware-profile") || "classic_webview",
          receiverInstallId: receiverState.receiverInstallId,
          receiverUrl: receiverUrlForPairing(),
          uiLayout: document.body.getAttribute("data-ui-layout") || "desk_phone_1024x600"
        }, function (status, payload) {
          if (status >= 200 && status < 300 && payload && payload.pairingCode) {
            receiverState.pairingCode = payload.pairingCode;
            receiverState.pairingDeviceId = payload.receiverDeviceId || "";
            setText("pairingCode", formatPairingCode(payload.pairingCode));
            showSetupStatus("Enter this code in Connect to pair this Receiver.");
            pollClassicPairing(callback);
            return;
          }
          showSetupStatus(payload.error || "Receiver setup could not start.");
        });
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
        if (!receiverState.personId) {
          setText("focusStrip", "Receiver is connecting...");
          setText("focusStripSecond", "");
          setText("focusStripThird", "");
          return;
        }
        jsonRequest(
          "GET",
          "/api/connect/today-focus?personId=" + encodeURIComponent(receiverState.personId),
          null,
          function (status, payload) {
            var items = payload && payload.focusItems && payload.focusItems.length
              ? payload.focusItems
              : [];
            if (!items.length) {
              setText("focusStrip", "Nothing due");
              setText("focusStripSecond", "");
              setText("focusStripThird", "");
              return;
            }
            setText("focusStrip", items[0] && items[0].title ? items[0].title : "");
            setText("focusStripSecond", items[1] && items[1].title ? items[1].title : "");
            setText("focusStripThird", items[2] && items[2].title ? items[2].title : "");
            document.getElementById("focusStripSecond").className = items[1] && items[1].title
              ? "focusItem"
              : "focusItem focusItemSecondary";
            document.getElementById("focusStripThird").className = items[2] && items[2].title
              ? "focusItem"
              : "focusItem focusItemTertiary";
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
      applyReceiverFrameScale();
      updateReceiverChromeControls();
      bindButtons();
      window.onresize = function () {
        applyReceiverFrameScale();
        updateFullscreenPrompt();
      };
      document.addEventListener("fullscreenchange", function () {
        updateFullscreenPrompt();
      });
      document.addEventListener("webkitfullscreenchange", function () {
        updateFullscreenPrompt();
      });
      document.getElementById("newPairingCodeButton").onclick = function () {
        startClassicPairing(function () {
          loadAppointments();
          loadTodayFocus();
          loadMessages();
        });
      };
      window.setInterval(updateClock, 30000);
      connectNativeReceiver(function () {
        showScreen("homeScreen");
        loadAppointments();
        loadTodayFocus();
        loadMessages();
      });
      window.setInterval(function () {
        if (!receiverState.receiverDeviceId) return;
        connectNativeReceiver(function () {
          loadAppointments();
          loadTodayFocus();
          loadMessages();
        });
      }, 60000);
      updateFullscreenPrompt();
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

function safeCssClass(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
