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
      background: transparent;
      border: 0;
      box-sizing: border-box;
      color: #101915;
      display: block;
      font-size: 27px;
      font-weight: 900;
      line-height: 1.1;
      margin: 10px 0;
      min-height: 34px;
      overflow: hidden;
      padding-left: 46px;
      position: relative;
      text-align: left;
      white-space: nowrap;
      width: 100%;
    }
    .focusItem:disabled {
      color: #101915;
      opacity: 1;
    }
    .focusItemDone {
      color: #5d6961;
      text-decoration: line-through;
    }
    .focusItemDone:after {
      color: #1f6d19;
      content: "✓";
      font-size: 25px;
      font-weight: 900;
      left: 4px;
      position: absolute;
      top: -2px;
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
    .talkInput {
      border: 4px solid #aeb6b0;
      border-radius: 6px;
      box-sizing: border-box;
      color: #101915;
      display: block;
      font-size: 36px;
      font-weight: 900;
      height: 92px;
      padding: 16px;
      width: 100%;
    }
    .talkResult {
      background: #eef2ed;
      border: 3px solid #aeb6b0;
      border-radius: 6px;
      box-sizing: border-box;
      color: #101915;
      font-size: 28px;
      font-weight: 900;
      line-height: 1.18;
      margin-top: 16px;
      min-height: 86px;
      padding: 18px;
      text-align: center;
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
    .cleaningCard {
      background: #101211;
      border-color: #2d3430;
      color: #ffffff;
      text-align: center;
    }
    .cleaningTitle {
      font-size: 70px;
      font-weight: 900;
      line-height: 1;
      margin-top: 50px;
    }
    .cleaningTimer {
      color: #ffffff;
      font-size: 86px;
      font-weight: 900;
      line-height: 1;
      margin-top: 28px;
    }
    .cleaningHelp {
      color: #d9e1dc;
      font-size: 31px;
      font-weight: 900;
      margin-top: 22px;
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
      background: transparent;
      border: 0;
      border-bottom: 2px solid #d4d9d2;
      box-sizing: border-box;
      color: #101915;
      display: block;
      font-size: 32px;
      font-weight: 900;
      line-height: 1.2;
      padding: 14px 0;
      text-align: left;
      width: 100%;
    }
    .messageItemRead {
      color: #5d6961;
      font-weight: 700;
    }
    .appointmentList {
      margin-top: 16px;
    }
    .appointmentItem {
      background: #fbfaf5;
      border: 3px solid #aeb6b0;
      border-radius: 6px;
      box-sizing: border-box;
      color: #101915;
      display: block;
      font-size: 28px;
      font-weight: 900;
      height: 66px;
      margin: 0 0 10px;
      overflow: hidden;
      padding: 8px 14px;
      text-align: left;
      white-space: nowrap;
      width: 100%;
    }
    .appointmentSelected {
      border-color: #1d4c73;
      color: #1d4c73;
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
    .guideRectTarget {
      border: 8px solid #ffcf33;
      border-radius: 12px;
      box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.36), 0 0 18px rgba(255, 207, 51, 0.95);
      box-sizing: border-box;
      display: none;
      height: 80px;
      left: 0;
      pointer-events: none;
      position: absolute;
      top: 0;
      width: 160px;
      z-index: 18;
    }
    .guideRectTargetVisible {
      display: block;
    }
    .guideRectLabel {
      background: #ffcf33;
      border-radius: 8px;
      color: #101915;
      font-size: 24px;
      font-weight: 900;
      left: 0;
      line-height: 1.1;
      min-width: 180px;
      padding: 10px 14px;
      position: absolute;
      top: -58px;
      white-space: nowrap;
    }
    .guideIdentifyCode {
      background: #ffcf33;
      border: 5px solid #101915;
      border-radius: 12px;
      box-shadow: 0 7px 0 rgba(70, 64, 56, 0.65);
      color: #101915;
      display: none;
      font-size: 76px;
      font-weight: 900;
      left: 50%;
      line-height: 1;
      padding: 18px 34px;
      position: absolute;
      top: 210px;
      transform: translateX(-50%);
      z-index: 19;
    }
    .guideIdentifyCodeVisible {
      display: block;
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
        <div class="bootStatus" id="bootStatus">Starting Receiver...</div>
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
        <button class="setupButton" id="newPairingCodeButton" onclick="window.location.reload(); return false;">New Code</button>
      </div>
    </div>
  </div>

  <div class="screen" id="homeScreen">
    <div class="receiverHome">
      <div class="homeLeftPane">
        <div class="focusPanel">
          <h1>Today&apos;s Focus</h1>
          <button class="focusItem" id="focusStrip" type="button" data-focus-index="0">Loading Today&apos;s Focus...</button>
          <button class="focusItem focusItemSecondary" id="focusStripSecond" type="button" data-focus-index="1"></button>
          <button class="focusItem focusItemTertiary" id="focusStripThird" type="button" data-focus-index="2"></button>
        </div>
        <button class="homeAppointmentButton" data-screen="appointmentScreen">
          <span class="homeAppointmentDay" id="homeAppointmentDay">${escapeHtml(appointmentDay)}</span>
          <span class="homeAppointmentTime" id="homeAppointmentTime">${escapeHtml(appointmentTime)}</span><span>: </span>
          <span id="homeAppointmentTitle">${escapeHtml(appointmentTitle)}</span>
        </button>
        <button class="homeTalkButton" data-screen="talkScreen">
          <span class="talkIconCell"><span class="talkIcon">♪</span></span>
          <span class="talkLabelCell">Talk</span>
        </button>
      </div>
      <div class="homeRightPane">
        <button class="homeActionButton blue" data-screen="messagesScreen">Messages</button>
        <button class="homeActionButton blue" data-screen="appointmentScreen">Appointment</button>
        <button class="homeActionButton" data-screen="askScreen">Ask a Question</button>
        <button class="homeActionButton" id="callAndrewButton" type="button">Call Andrew</button>
      </div>
      <div class="receiverFooter">
        <div class="footerLogo"><span class="cpLogo">CP</span></div>
        <div class="footerGreeting"><span id="greeting">Good afternoon</span><span class="name" id="receiverName">${escapeHtml(displayName)}</span></div>
        <div class="footerClock" id="time">--:--</div>
        <div class="footerDate"><span id="date">--</span></div>
        <div class="footerButtonCell"><button class="footerButton" id="soundsButton" type="button">Sounds</button></div>
        <div class="footerButtonCell"><button class="footerButton" id="cleanButton" type="button">Clean</button></div>
      </div>
      <div class="miniStatus" id="connectionStatus">Starting...</div>
      <div id="receiverLocation" style="display:none">${escapeHtml(locationLabel)}</div>
    </div>
  </div>

  <div class="screen" id="talkScreen">
    <div class="toolbar">
      <div class="toolbarTitle">Talk</div>
      <div class="toolbarAction"><button class="homeButton" data-screen="homeScreen">Go Home</button></div>
    </div>
    <div class="panelBody">
      <div class="whiteCard">
        <input class="talkInput" id="talkInput" value="I took my medicine">
        <div class="quickGrid">
          <div class="quickRow">
            <div class="quickCell"><button class="quickButton" data-talk="I took my medicine">Took medicine</button></div>
            <div class="quickCell"><button class="quickButton" data-talk="I weighed myself">Weighed myself</button></div>
          </div>
          <div class="quickRow">
            <div class="quickCell"><button class="quickButton" data-talk="What time is my appointment?">Appointment time</button></div>
            <div class="quickCell"><button class="quickButton" data-talk="Call Andrew">Call Andrew</button></div>
          </div>
        </div>
        <button class="sendButton" id="sendTalkButton">Send</button>
        <div class="talkResult" id="talkResult">Tap a phrase or send your words.</div>
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
        <div class="callTitle" id="callTitle">Connect Call</div>
        <div class="callSub" id="callStatus">Connecting...</div>
        <button class="doneButton" id="closeCallButton" type="button">Close Call</button>
      </div>
    </div>
  </div>

  <div class="screen" id="soundsScreen">
    <div class="toolbar">
      <div class="toolbarTitle">Sounds</div>
      <div class="toolbarAction"><button class="homeButton" data-screen="homeScreen">Go Home</button></div>
    </div>
    <div class="panelBody">
      <div class="whiteCard">
        <div class="detailTitle">Sound check</div>
        <div class="detailTime" id="soundStatus">Tap Play Sound.</div>
        <button class="doneButton" id="playSoundButton" type="button">Play Sound</button>
      </div>
    </div>
  </div>

  <div class="screen" id="cleaningScreen">
    <div class="toolbar">
      <div class="toolbarTitle">Clean Screen</div>
      <div class="toolbarAction"><button class="homeButton" id="finishCleaningButton" type="button">Done</button></div>
    </div>
    <div class="panelBody">
      <div class="whiteCard cleaningCard">
        <div class="cleaningTitle">Wipe the screen</div>
        <div class="cleaningTimer" id="cleaningTimer">30</div>
        <div class="cleaningHelp">Touch is paused until Done.</div>
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
        <div class="appointmentList" id="appointmentList"></div>
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
        <div class="sent" id="messageDetail"></div>
        <div class="detailTime" id="messagesPager">&lt; &nbsp; 1 / 1 &nbsp; &gt;</div>
      </div>
    </div>
  </div>
  <div class="guideRectTarget" id="guideRectTarget" aria-hidden="true">
    <div class="guideRectLabel" id="guideRectLabel">CarePland is pointing here.</div>
  </div>
  <div class="guideIdentifyCode" id="guideIdentifyCode" aria-hidden="true"></div>
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
      var fallbackInstallStorageKey = "carepland-connect-classic-receiver-install-id";
      var fallbackBindingStorageKey = "carepland-connect-receiver-binding";
      var fallbackInstallId = "";
      var fallbackPairingCode = "";
      var fallbackPairingDeviceId = "";
      var fallbackPairingPollTimer = null;

      function fallbackText(value) {
        return value === null || value === undefined ? "" : String(value);
      }
      function fallbackJsonRequest(method, url, body, callback) {
        var completed = false;
        try {
          var request = new XMLHttpRequest();
          request.open(method, url, true);
          request.setRequestHeader("Accept", "application/json");
          if (body) request.setRequestHeader("Content-Type", "application/json");
          request.onreadystatechange = function () {
            if (request.readyState !== 4 || completed) return;
            completed = true;
            var payload = {};
            try {
              payload = JSON.parse(request.responseText || "{}");
            } catch (error) {}
            callback(request.status, payload);
          };
          window.setTimeout(function () {
            if (completed) return;
            completed = true;
            callback(0, { error: "Receiver setup request timed out." });
          }, 12000);
          request.send(body ? JSON.stringify(body) : null);
        } catch (error) {
          if (!completed) callback(0, { error: "Receiver setup request failed." });
        }
      }
      function fallbackInstallIdValue() {
        if (fallbackInstallId) return fallbackInstallId;
        try {
          fallbackInstallId = window.localStorage ? window.localStorage.getItem(fallbackInstallStorageKey) || "" : "";
          if (fallbackInstallId) return fallbackInstallId;
          fallbackInstallId = "classic-web-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000000);
          if (window.localStorage) window.localStorage.setItem(fallbackInstallStorageKey, fallbackInstallId);
        } catch (error) {
          fallbackInstallId = "classic-web-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000000);
        }
        return fallbackInstallId;
      }
      function fallbackFormatPairingCode(value) {
        var digits = fallbackText(value).replace(/\\D/g, "");
        if (digits.length === 6) return digits.substr(0, 3) + " " + digits.substr(3, 3);
        return fallbackText(value) || "---";
      }
      function fallbackReceiverUrl() {
        return window.location.protocol + "//" + window.location.host + "/connect/receiver/legacy?receiver_runtime=classic_webview";
      }
      function showSetupFallback(message) {
        var boot = document.getElementById("bootScreen");
        var setup = document.getElementById("setupScreen");
        var status = document.getElementById("setupStatus");
        if (boot && boot.className.indexOf("screenActive") >= 0) {
          boot.className = boot.className.replace(" screenActive", "");
          if (setup && setup.className.indexOf("screenActive") < 0) {
            setup.className += " screenActive";
          }
        }
        if (status) status.innerHTML = message || "Receiver setup is taking longer than expected. Tap New Code or reopen the app.";
      }
      function fallbackSaveBinding(payload) {
        if (!payload || !payload.receiverDeviceId) return;
        try {
          if (window.localStorage) {
            window.localStorage.setItem(fallbackBindingStorageKey, JSON.stringify({
              bindingStatus: payload.bindingStatus || "bound",
              deviceProfile: payload.deviceProfile || "",
              hardwareProfile: payload.hardwareProfile || "",
              mainConnectUserPersonId: payload.mainConnectUserPersonId || "",
              receiverDeviceId: payload.receiverDeviceId || "",
              receiverInstallId: payload.receiverInstallId || fallbackInstallIdValue(),
              receiverUrl: payload.receiverUrl || "",
              storageSource: "classic_fallback",
              uiLayout: payload.uiLayout || ""
            }));
          }
        } catch (error) {}
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
      function fallbackRedeemPairingClaim(claim) {
        showSetupFallback("Receiver detected. Finishing setup...");
        fallbackJsonRequest("POST", "/api/connect/receiver-shell/claims/redeem", {
          claim: claim,
          receiverInstallId: fallbackInstallIdValue()
        }, function (status, payload) {
          if (status >= 200 && status < 300 && payload && payload.ok !== false) {
            fallbackSaveBinding(payload);
            showSetupFallback("Receiver ready. Opening CarePland...");
            window.setTimeout(function () {
              window.location.reload();
            }, 500);
            return;
          }
          showSetupFallback(payload && payload.error ? payload.error : "Receiver setup could not be completed.");
        });
      }
      function fallbackPollPairing() {
        if (!fallbackPairingCode) return;
        var url = "/api/connect/receiver-shell/pairing-sessions?code=" + encodeURIComponent(fallbackPairingCode);
        if (fallbackPairingDeviceId) url += "&receiverDeviceId=" + encodeURIComponent(fallbackPairingDeviceId);
        fallbackJsonRequest("GET", url, null, function (status, payload) {
          if (status >= 200 && status < 300 && payload && payload.ok !== false) {
            if (payload.status === "paired" && payload.claim) {
              fallbackRedeemPairingClaim(payload.claim);
              return;
            }
            if (payload.status === "expired") {
              showSetupFallback("This code expired. Tap New Code.");
              return;
            }
          }
          fallbackPairingPollTimer = window.setTimeout(fallbackPollPairing, 2500);
        });
      }
      function fallbackRequestPairingCode() {
        var pairingCodeElement = document.getElementById("pairingCode");
        if (fallbackPairingPollTimer) window.clearTimeout(fallbackPairingPollTimer);
        showSetupFallback("Getting a Receiver pairing code...");
        if (pairingCodeElement) pairingCodeElement.innerHTML = "---";
        fallbackJsonRequest("POST", "/api/connect/receiver-shell/pairing-sessions", {
          deviceProfile: "classic_webview",
          hardwareProfile: document.body.getAttribute("data-hardware-profile") || "classic_webview",
          receiverInstallId: fallbackInstallIdValue(),
          receiverUrl: fallbackReceiverUrl(),
          uiLayout: document.body.getAttribute("data-ui-layout") || "desk_phone_1024x600"
        }, function (status, payload) {
          if (status >= 200 && status < 300 && payload && payload.pairingCode) {
            fallbackPairingCode = payload.pairingCode;
            fallbackPairingDeviceId = payload.receiverDeviceId || "";
            if (pairingCodeElement) pairingCodeElement.innerHTML = fallbackFormatPairingCode(payload.pairingCode);
            showSetupFallback("Enter this code in Connect to pair this Receiver.");
            fallbackPollPairing();
            return;
          }
          showSetupFallback(payload && payload.error ? payload.error : "Could not get a Receiver pairing code.");
        });
      }
      window.__careplandClassicShowSetupFallback = showSetupFallback;
      window.__careplandClassicRequestPairingCode = fallbackRequestPairingCode;
      window.onerror = function (message) {
        showSetupFallback("Receiver startup hit an older-device script problem. Tap New Code or reopen the app.");
        return false;
      };
      var newCodeButton = document.getElementById("newPairingCodeButton");
      if (newCodeButton) {
        newCodeButton.onclick = function () {
          fallbackRequestPairingCode();
          return false;
        };
      }
      try {
        if (window.CarePlandReceiver && window.CarePlandReceiver.receiverReady) {
          window.CarePlandReceiver.receiverReady();
        }
      } catch (error) {}
      window.setTimeout(function () {
        var pairingCodeElement = document.getElementById("pairingCode");
        if (pairingCodeElement && pairingCodeElement.innerHTML === "---") {
          fallbackRequestPairingCode();
          return;
        }
        showSetupFallback("Receiver setup is taking longer than expected. Tap New Code or reopen the app.");
      }, 7000);
    }());
  </script>

  <script>
    (function () {
      var receiverState = {
        activeCallId: "",
        cleaningSessionId: "",
        cleaningStartedAt: "",
        receiverDeviceId: "",
        receiverInstallId: "",
        pairingCode: "",
        pairingDeviceId: "",
        personId: "",
        receiverSessionId: "",
        appointments: [],
        messages: [],
        todayFocusItems: [],
        online: false
      };
      var browserBindingStorageKey = "carepland-connect-receiver-binding";
      var browserInstallStorageKey = "carepland-connect-classic-receiver-install-id";
      var classicCachePrefix = "carepland-connect-classic-cache";
      var guideSessionStorageKey = "carepland-connect-classic-guide-session";
      var incomingCallPollTimer = null;
      var pairingPollTimer = null;
      var cleaningTimer = null;
      var guidePollTimer = null;
      var cleaningRemainingSeconds = 30;

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
      function addClass(element, className) {
        if (!element || element.className.indexOf(className) >= 0) return;
        element.className += " " + className;
      }
      function removeClass(element, className) {
        if (!element) return;
        element.className = element.className.replace(new RegExp("(^|\\\\s)" + className + "(\\\\s|$)", "g"), " ").replace(/^\\s+|\\s+$/g, "");
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
      function scopedCacheKey(name) {
        return classicCachePrefix + "-" + name + "-" + (receiverState.personId || "unbound");
      }
      function readCachedItems(name) {
        if (!receiverState.personId) return [];
        try {
          var raw = window.localStorage ? window.localStorage.getItem(scopedCacheKey(name)) : "";
          var parsed = raw ? JSON.parse(raw) : null;
          return parsed && parsed.items && parsed.items.length ? parsed.items : [];
        } catch (error) {
          return [];
        }
      }
      function writeCachedItems(name, items) {
        if (!receiverState.personId || !items || !items.length) return;
        try {
          if (window.localStorage) {
            window.localStorage.setItem(scopedCacheKey(name), JSON.stringify({
              cachedAt: new Date().toISOString(),
              items: items
            }));
          }
        } catch (error) {}
      }
      function readOrCreateGuideSessionId() {
        if (receiverState.receiverSessionId) return receiverState.receiverSessionId;
        var current = "";
        try {
          current = window.sessionStorage ? window.sessionStorage.getItem(guideSessionStorageKey) : "";
        } catch (error) {}
        if (!current) {
          current = "classic-guide-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000000);
          try {
            if (window.sessionStorage) window.sessionStorage.setItem(guideSessionStorageKey, current);
          } catch (error) {}
        }
        receiverState.receiverSessionId = current;
        return current;
      }
      function receiverGuideId() {
        return receiverState.receiverDeviceId ||
          receiverState.pairingDeviceId ||
          receiverState.receiverInstallId ||
          "classic-webview-receiver";
      }
      function clearGuideDisplay() {
        var rect = document.getElementById("guideRectTarget");
        var code = document.getElementById("guideIdentifyCode");
        if (rect) rect.className = "guideRectTarget";
        if (code) {
          code.className = "guideIdentifyCode";
          code.innerHTML = "";
        }
      }
      function showGuideRect(rect) {
        var element = document.getElementById("guideRectTarget");
        var label = document.getElementById("guideRectLabel");
        if (!element || !rect) {
          clearGuideDisplay();
          return;
        }
        element.style.left = Math.max(0, Number(rect.x || 0)) + "px";
        element.style.top = Math.max(0, Number(rect.y || 0)) + "px";
        element.style.width = Math.max(24, Number(rect.width || 24)) + "px";
        element.style.height = Math.max(24, Number(rect.height || 24)) + "px";
        if (label) label.innerHTML = escapeHtml(rect.label || "CarePland is pointing here.");
        element.className = "guideRectTarget guideRectTargetVisible";
      }
      function showGuideIdentifyCode(value) {
        var element = document.getElementById("guideIdentifyCode");
        if (!element) return;
        if (!value) {
          element.className = "guideIdentifyCode";
          element.innerHTML = "";
          return;
        }
        element.innerHTML = escapeHtml(value);
        element.className = "guideIdentifyCode guideIdentifyCodeVisible";
      }
      function recordGuidePress(button) {
        var rect = document.getElementById("guideRectTarget");
        var code = document.getElementById("guideIdentifyCode");
        var guideActive =
          (rect && rect.className.indexOf("guideRectTargetVisible") >= 0) ||
          (code && code.className.indexOf("guideIdentifyCodeVisible") >= 0);
        if (!guideActive) return;
        jsonRequest("POST", "/api/connect/receiver-guide", {
          action: "press",
          label: button ? (button.getAttribute("aria-label") || button.innerText || button.textContent || "Receiver control") : "Receiver control",
          pressedAt: new Date().getTime(),
          receiverId: receiverGuideId(),
          receiverSessionId: readOrCreateGuideSessionId(),
          target: button ? (button.getAttribute("data-screen") || button.id || button.getAttribute("data-layout-choice") || "") : ""
        }, function () {});
        clearGuideDisplay();
      }
      function syncReceiverGuide() {
        var receiverId = receiverGuideId();
        var receiverSessionId = readOrCreateGuideSessionId();
        jsonRequest("POST", "/api/connect/receiver-guide", {
          action: "presence",
          deviceProfile: document.body.getAttribute("data-hardware-profile") || "classic_webview",
          pageUrl: window.location.pathname + window.location.search,
          receiverId: receiverId,
          receiverSessionId: receiverSessionId,
          uiLayout: document.body.getAttribute("data-ui-layout") || "classic_webview"
        }, function () {
          jsonRequest("GET", "/api/connect/receiver-guide?receiverId=" + encodeURIComponent(receiverId), null, function (status, payload) {
            var guide = payload && payload.guide ? payload.guide : null;
            var targetSessionId = guide && guide.targetReceiverSessionId ? guide.targetReceiverSessionId : "";
            var requests = guide && guide.identifyRequests && guide.identifyRequests.length ? guide.identifyRequests : [];
            var identifyCode = "";
            var i;
            if (targetSessionId && targetSessionId !== receiverSessionId) {
              clearGuideDisplay();
              return;
            }
            for (i = 0; i < requests.length; i += 1) {
              if (requests[i].receiverSessionId === receiverSessionId && Number(requests[i].expiresAt || 0) > new Date().getTime()) {
                identifyCode = requests[i].code || "";
              }
            }
            if (guide && guide.rect) {
              showGuideRect(guide.rect);
            } else {
              var rect = document.getElementById("guideRectTarget");
              if (rect) rect.className = "guideRectTarget";
            }
            showGuideIdentifyCode(identifyCode);
          });
        });
      }
      function startReceiverGuideSync() {
        readOrCreateGuideSessionId();
        if (guidePollTimer) window.clearInterval(guidePollTimer);
        syncReceiverGuide();
        guidePollTimer = window.setInterval(syncReceiverGuide, 2000);
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
        document.addEventListener("click", function (event) {
          var node = event.target;
          while (node && node !== document) {
            if (node.tagName && String(node.tagName).toLowerCase() === "button") {
              recordGuidePress(node);
              return;
            }
            node = node.parentNode;
          }
        });
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
        var focusButtons = document.querySelectorAll("[data-focus-index]");
        for (i = 0; i < focusButtons.length; i += 1) {
          focusButtons[i].onclick = function () {
            completeTodayFocus(Number(this.getAttribute("data-focus-index")));
          };
        }
        document.getElementById("cleanButton").onclick = function () {
          startCleaningMode();
        };
        document.getElementById("finishCleaningButton").onclick = function () {
          finishCleaningMode();
        };
        document.getElementById("soundsButton").onclick = function () {
          showScreen("soundsScreen");
        };
        document.getElementById("playSoundButton").onclick = function () {
          playSoundCheck();
        };
        document.getElementById("callAndrewButton").onclick = function () {
          startCallAndrew();
        };
        document.getElementById("closeCallButton").onclick = function () {
          closeActiveCall();
        };
        document.getElementById("sendTalkButton").onclick = function () {
          sendTalkInput("");
        };
        var talkButtons = document.querySelectorAll("[data-talk]");
        for (i = 0; i < talkButtons.length; i += 1) {
          talkButtons[i].onclick = function () {
            sendTalkInput(this.getAttribute("data-talk"));
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
      function clearStoredBinding() {
        try {
          if (window.localStorage) window.localStorage.removeItem(browserBindingStorageKey);
        } catch (error) {}
        receiverState.receiverDeviceId = "";
        receiverState.personId = "";
        receiverState.online = false;
      }
      function hasNativeReceiverBridge() {
        return !!(window.CarePlandReceiver && window.CarePlandReceiver.getProvisioningJson);
      }
      function bindingNeedsFreshPairing(status, payload) {
        var errorMessage = payload && payload.error ? payload.error : "";
        return status === 403 ||
          status === 404 ||
          errorMessage.indexOf("binding not found") >= 0 ||
          errorMessage.indexOf("binding was revoked") >= 0;
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
            if (bindingNeedsFreshPairing(status, payload)) {
              clearStoredBinding();
              startClassicPairing(callback);
              return;
            }
            if (errorMessage.indexOf("not complete") >= 0) {
              showScreen("setupScreen");
              setText("connectionStatus", "Pairing finishing");
              setText("focusStrip", "Receiver is connecting...");
              setText("setupStatus", "Pairing is finishing. CarePland will keep trying.");
            } else {
              showScreen("setupScreen");
              setText("connectionStatus", "Setup needed");
              setText("focusStrip", "Receiver setup is needed.");
              setText("setupStatus", errorMessage);
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
        var cached = readCachedItems("appointments");
        if (cached.length) {
          renderAppointments(cached);
        }
        jsonRequest(
          "GET",
          "/api/connect/appointments?personId=" + encodeURIComponent(receiverState.personId),
          null,
          function (status, payload) {
            var appointments = payload && payload.appointments && payload.appointments.length
              ? payload.appointments
              : [];
            if (status >= 200 && status < 300 && payload && payload.ok !== false) {
              if (appointments.length) writeCachedItems("appointments", appointments);
              renderAppointments(appointments);
              return;
            }
            if (!cached.length) renderAppointments([]);
          }
        );
      }
      function renderAppointments(appointments) {
        receiverState.appointments = appointments || [];
        if (!receiverState.appointments.length) {
          setText("homeAppointmentDay", "No appointment");
          setText("homeAppointmentTitle", "Nothing scheduled");
          setText("homeAppointmentTime", "");
          setText("appointmentDetailTitle", "No upcoming appointments");
          setText("appointmentDetailTime", "");
          setText("appointmentDetailMeta", "CarePland will show the next appointment here.");
          setHtml("appointmentList", "");
          return;
        }
        renderSelectedAppointment(0);
        renderAppointmentList();
      }
      function appointmentLabel(appt) {
        var title = appt && (appt.title || appt.reason) ? (appt.title || appt.reason) : "Appointment";
        var day = formatAppointmentDate(appt ? appt.startsAt : "");
        var time = formatAppointmentTime(appt ? appt.startsAt : "");
        return (day || "Upcoming") + " " + (time || "") + ": " + title;
      }
      function renderSelectedAppointment(index) {
        var appt = receiverState.appointments[index];
        if (!appt) return;
        var title = appt.title || appt.reason || "Appointment";
        var day = formatAppointmentDate(appt.startsAt);
        var time = formatAppointmentTime(appt.startsAt);
        if (index === 0) {
            setText("homeAppointmentDay", day || "Upcoming");
            setText("homeAppointmentTitle", title);
            setText("homeAppointmentTime", time);
        }
        setText("appointmentDetailTitle", title);
        setHtml("appointmentDetailTime", escapeHtml(day || "Upcoming") + " &bull; " + escapeHtml(time));
        setText(
          "appointmentDetailMeta",
          appt.providerName || appt.providerOrganization || appt.locationName || appt.locationAddress || ""
        );
        highlightSelectedAppointment(index);
      }
      function renderAppointmentList() {
        var html = "";
        var i;
        for (i = 0; i < receiverState.appointments.length && i < 4; i += 1) {
          html += '<button class="appointmentItem" type="button" data-appointment-index="' + i + '">' +
            escapeHtml(appointmentLabel(receiverState.appointments[i])) +
            "</button>";
        }
        setHtml("appointmentList", html);
        bindAppointmentItems();
        highlightSelectedAppointment(0);
      }
      function bindAppointmentItems() {
        var items = document.querySelectorAll("[data-appointment-index]");
        var i;
        for (i = 0; i < items.length; i += 1) {
          items[i].onclick = function () {
            renderSelectedAppointment(Number(this.getAttribute("data-appointment-index")));
          }
        }
      }
      function highlightSelectedAppointment(index) {
        var items = document.querySelectorAll("[data-appointment-index]");
        var i;
        for (i = 0; i < items.length; i += 1) {
          items[i].className = Number(items[i].getAttribute("data-appointment-index")) === index
            ? "appointmentItem appointmentSelected"
            : "appointmentItem";
        }
      }
      function loadTodayFocus() {
        if (!receiverState.personId) {
          receiverState.todayFocusItems = [];
          setText("focusStrip", "Receiver is connecting...");
          setText("focusStripSecond", "");
          setText("focusStripThird", "");
          return;
        }
        var cached = readCachedItems("today-focus");
        if (cached.length) renderTodayFocusItems(cached);
        jsonRequest(
          "GET",
          "/api/connect/today-focus?personId=" + encodeURIComponent(receiverState.personId),
          null,
          function (status, payload) {
            var items = payload && payload.focusItems && payload.focusItems.length
              ? payload.focusItems
              : [];
            if (status >= 200 && status < 300 && payload && payload.ok !== false) {
              if (items.length) writeCachedItems("today-focus", items);
              renderTodayFocusItems(items);
              return;
            }
            if (!cached.length) renderTodayFocusItems([]);
          }
        );
      }
      function renderTodayFocusItems(items) {
        receiverState.todayFocusItems = items || [];
        if (!receiverState.todayFocusItems.length) {
          renderFocusItem("focusStrip", null, "Nothing due");
          renderFocusItem("focusStripSecond", null, "");
          renderFocusItem("focusStripThird", null, "");
          return;
        }
        renderFocusItem("focusStrip", receiverState.todayFocusItems[0], "");
        renderFocusItem("focusStripSecond", receiverState.todayFocusItems[1], "");
        renderFocusItem("focusStripThird", receiverState.todayFocusItems[2], "");
      }
      function renderFocusItem(id, item, emptyLabel) {
        var element = document.getElementById(id);
        if (!element) return;
        removeClass(element, "focusItemDone");
        element.disabled = !item || !item.id;
        setText(id, item && item.title ? item.title : emptyLabel);
        if (id === "focusStripSecond") {
          element.className = item && item.title ? "focusItem" : "focusItem focusItemSecondary";
        }
        if (id === "focusStripThird") {
          element.className = item && item.title ? "focusItem" : "focusItem focusItemTertiary";
        }
      }
      function completeTodayFocus(index) {
        var item = receiverState.todayFocusItems[index];
        var elementId = index === 0 ? "focusStrip" : index === 1 ? "focusStripSecond" : "focusStripThird";
        var element = document.getElementById(elementId);
        if (!item || !item.id || !receiverState.personId) return;
        if (element) {
          element.disabled = true;
          addClass(element, "focusItemDone");
        }
        setText("connectionStatus", "Saving Focus");
        jsonRequest("POST", "/api/connect/today-focus", {
          focusItemId: item.id,
          occurredAt: new Date().toISOString(),
          personId: receiverState.personId
        }, function (status, payload) {
          if (status >= 200 && status < 300 && payload && payload.ok !== false) {
            setText("connectionStatus", "Focus saved");
            window.setTimeout(loadTodayFocus, 650);
            return;
          }
          if (element) {
            element.disabled = false;
            removeClass(element, "focusItemDone");
          }
          setText("connectionStatus", payload.error || "Focus not saved");
        });
      }
      function loadMessages() {
        if (!receiverState.personId) return;
        var cached = readCachedItems("messages");
        if (cached.length) renderMessages(cached);
        jsonRequest(
          "GET",
          "/api/connect/messages?personId=" + encodeURIComponent(receiverState.personId),
          null,
          function (status, payload) {
            var messages = payload && payload.messages && payload.messages.length
              ? payload.messages
              : [];
            if (status >= 200 && status < 300 && payload && payload.ok !== false) {
              if (messages.length) writeCachedItems("messages", messages);
              renderMessages(messages);
              return;
            }
            if (!cached.length) renderMessages([]);
          }
        );
      }
      function renderMessages(messages) {
        receiverState.messages = messages || [];
        var html = "";
        var i;
        if (!receiverState.messages.length) {
          setText("messagesEmpty", "No messages yet.");
          setHtml("messageList", "");
          setText("messageDetail", "");
          setHtml("messagesPager", "&lt; &nbsp; 1 / 1 &nbsp; &gt;");
          return;
        }
        setText("messagesEmpty", "");
        for (i = 0; i < receiverState.messages.length && i < 4; i += 1) {
          html += '<button class="messageItem' + (receiverState.messages[i].readAt ? " messageItemRead" : "") + '" type="button" data-message-index="' + i + '">' +
            escapeHtml(receiverState.messages[i].body || receiverState.messages[i].transcript || "Message") +
            "</button>";
        }
        setHtml("messageList", html);
        setText("messagesPager", "1 / " + Math.max(1, receiverState.messages.length));
        bindMessageItems();
      }
      function bindMessageItems() {
        var items = document.querySelectorAll("[data-message-index]");
        var i;
        for (i = 0; i < items.length; i += 1) {
          items[i].onclick = function () {
            openMessage(Number(this.getAttribute("data-message-index")));
          };
        }
      }
      function openMessage(index) {
        var message = receiverState.messages[index];
        if (!message) return;
        var body = message.body || message.transcript || "Message";
        setText("messageDetail", body);
        if (!message.readAt && message.id && receiverState.personId) {
          jsonRequest("PATCH", "/api/connect/messages/" + encodeURIComponent(message.id) + "/state", {
            mainConnectUserPersonId: receiverState.personId,
            state: "read"
          }, function (status, payload) {
            if (status >= 200 && status < 300 && payload && payload.ok !== false) {
              message.readAt = new Date().toISOString();
              var item = document.querySelector('[data-message-index="' + index + '"]');
              if (item) item.className = "messageItem messageItemRead";
              return;
            }
            setText("connectionStatus", payload.error || "Message not marked read");
          });
        }
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
      function sendTalkInput(value) {
        var input = document.getElementById("talkInput");
        var body = value || (input ? input.value.replace(/^\\s+|\\s+$/g, "") : "");
        if (input && value) input.value = value;
        if (!body) {
          setText("talkResult", "Say or tap what happened first.");
          return;
        }
        if (!receiverState.personId) {
          setText("talkResult", "Receiver is still connecting.");
          return;
        }
        setText("talkResult", "Checking...");
        jsonRequest("POST", "/api/connect/talk", {
          contacts: [{ displayName: "Andrew", id: "contact-andrew" }],
          inputText: body,
          personId: receiverState.personId,
          receiverDeviceId: receiverState.receiverDeviceId
        }, function (status, payload) {
          var result = payload && payload.result ? payload.result : {};
          var response = result.display_response || result.spoken_response || payload.error || "";
          if (status >= 200 && status < 300 && payload && payload.ok !== false) {
            if (String(result.intent || "") === "connect_call_request" || String(result.proposed_action || "") === "request_call") {
              setText("talkResult", response || "Calling Andrew.");
              startCallAndrew();
              return;
            }
            setText("talkResult", response || "Done.");
            loadTodayFocus();
            loadAppointments();
            loadMessages();
            return;
          }
          setText("talkResult", response || "Talk could not process that yet.");
        });
      }
      function startCallAndrew() {
        showScreen("callScreen");
        setText("callTitle", "Calling Andrew");
        setText("callStatus", "Creating call...");
        if (!receiverState.personId) {
          setText("callStatus", "Receiver is still connecting.");
          return;
        }
        jsonRequest("POST", "/api/connect/calls", {
          callerName: "Receiver",
          mainConnectUserPersonId: receiverState.personId,
          recipientName: "Andrew",
          receiverId: receiverState.receiverDeviceId || "classic-webview-receiver",
          state: "ringing"
        }, function (status, payload) {
          if (status >= 200 && status < 300 && payload && payload.ok !== false) {
            receiverState.activeCallId = payload.call && payload.call.callId ? payload.call.callId : "";
            setText("callStatus", "Call requested. Use the handset or speaker.");
            return;
          }
          setText("callStatus", payload.error || "Could not start call.");
        });
      }
      function callIsFromDashboard(call) {
        var callerName = text(call && (call.callerName || call.callerDisplayName)).toLowerCase();
        return callerName !== "receiver";
      }
      function showIncomingCall(call) {
        if (!call || !call.callId || receiverState.activeCallId === call.callId) return;
        receiverState.activeCallId = call.callId;
        var callerName = call.callerName || "Andrew";
        showScreen("callScreen");
        setText("callTitle", "Call from " + callerName);
        setText("callStatus", "Connecting...");
        jsonRequest("POST", "/api/connect/calls/" + encodeURIComponent(call.callId) + "/state", {
          mainConnectUserPersonId: receiverState.personId,
          receiverDeviceId: receiverState.receiverDeviceId,
          receiverInstallId: receiverState.receiverInstallId,
          source: "receiver",
          surface: "classic_webview_receiver",
          state: "connected"
        }, function (status, payload) {
          if (status >= 200 && status < 300 && payload && payload.ok !== false) {
            setText("callTitle", "Connected with " + callerName);
            setText("callStatus", "Use the handset or speaker.");
            return;
          }
          setText("callStatus", payload.error || "Incoming call could not be answered.");
        });
      }
      function loadIncomingCalls() {
        var url = "";
        if (!receiverState.personId || !receiverState.receiverDeviceId) return;
        url = "/api/connect/calls?personId=" + encodeURIComponent(receiverState.personId) +
          "&receiverDeviceId=" + encodeURIComponent(receiverState.receiverDeviceId) +
          "&receiverInstallId=" + encodeURIComponent(receiverState.receiverInstallId || "");
        jsonRequest("GET", url, null, function (status, payload) {
          var calls = payload && payload.calls && payload.calls.length ? payload.calls : [];
          var activeCall = null;
          var i;
          if (!(status >= 200 && status < 300) || !payload || payload.ok === false) {
            if (payload && payload.error) setText("connectionStatus", payload.error);
            return;
          }
          setText("connectionStatus", "Online");
          for (i = 0; i < calls.length; i += 1) {
            if (!callIsFromDashboard(calls[i])) continue;
            if (calls[i].state === "ringing" || calls[i].state === "answered" || calls[i].state === "connected") {
              activeCall = calls[i];
              break;
            }
          }
          if (!activeCall) {
            if (receiverState.activeCallId) {
              receiverState.activeCallId = "";
              setText("connectionStatus", "Online");
            }
            return;
          }
          if (activeCall.state === "ringing") {
            showIncomingCall(activeCall);
            return;
          }
          receiverState.activeCallId = activeCall.callId || receiverState.activeCallId;
          if (activeCall.state === "answered" || activeCall.state === "connected") {
            showScreen("callScreen");
            setText("callTitle", "Connected with " + (activeCall.callerName || "Andrew"));
            setText("callStatus", "Use the handset or speaker.");
          }
        });
      }
      function startIncomingCallPolling() {
        if (incomingCallPollTimer) window.clearInterval(incomingCallPollTimer);
        loadIncomingCalls();
        incomingCallPollTimer = window.setInterval(loadIncomingCalls, 3000);
      }
      function closeActiveCall() {
        if (!receiverState.activeCallId || !receiverState.personId) {
          showScreen("homeScreen");
          return;
        }
        setText("callStatus", "Closing call...");
        jsonRequest("POST", "/api/connect/calls/" + encodeURIComponent(receiverState.activeCallId) + "/state", {
          mainConnectUserPersonId: receiverState.personId,
          receiverDeviceId: receiverState.receiverDeviceId,
          receiverInstallId: receiverState.receiverInstallId,
          source: "receiver",
          surface: "classic_webview_receiver",
          state: "hung_up"
        }, function (status, payload) {
          if (status >= 200 && status < 300 && payload && payload.ok !== false) {
            receiverState.activeCallId = "";
            setText("connectionStatus", "Call closed");
            showScreen("homeScreen");
            return;
          }
          setText("callStatus", payload.error || "Could not close call.");
        });
      }
      function recordAudioPlayback(state) {
        if (!receiverState.personId) return;
        jsonRequest("POST", "/api/connect/audio/playback-events", {
          audioUrl: "classic-webview-local-sound-check",
          mainConnectUserPersonId: receiverState.personId,
          playbackState: state,
          receiverId: receiverState.receiverDeviceId || "classic-webview-receiver",
          source: "classic_webview_receiver_sound_check",
          surface: "receiver_sounds_button"
        }, function () {});
      }
      function playSoundCheck() {
        setText("soundStatus", "Playing sound...");
        recordAudioPlayback("started");
        try {
          var AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) {
            recordAudioPlayback("fallback");
            setText("soundStatus", "Sound test is not available on this device.");
            return;
          }
          var context = new AudioContextClass();
          var oscillator = context.createOscillator();
          var gain = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = 660;
          gain.gain.value = 0.18;
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(0);
          window.setTimeout(function () {
            try {
              oscillator.stop(0);
              context.close();
            } catch (error) {}
            recordAudioPlayback("ended");
            setText("soundStatus", "Sound played.");
          }, 650);
        } catch (error) {
          recordAudioPlayback("error");
          setText("soundStatus", "Could not play sound.");
        }
      }
      function startCleaningMode() {
        receiverState.cleaningSessionId = "classic-cleaning-" + new Date().getTime();
        receiverState.cleaningStartedAt = new Date().toISOString();
        cleaningRemainingSeconds = 30;
        setText("cleaningTimer", cleaningRemainingSeconds);
        showScreen("cleaningScreen");
        recordCleaningSession(false);
        if (cleaningTimer) window.clearInterval(cleaningTimer);
        cleaningTimer = window.setInterval(function () {
          cleaningRemainingSeconds -= 1;
          if (cleaningRemainingSeconds < 0) cleaningRemainingSeconds = 0;
          setText("cleaningTimer", cleaningRemainingSeconds);
          if (cleaningRemainingSeconds <= 0) finishCleaningMode();
        }, 1000);
      }
      function finishCleaningMode() {
        if (cleaningTimer) {
          window.clearInterval(cleaningTimer);
          cleaningTimer = null;
        }
        recordCleaningSession(true);
        showScreen("homeScreen");
        setText("connectionStatus", "Screen cleaned");
      }
      function recordCleaningSession(completed) {
        if (!receiverState.cleaningSessionId || !receiverState.personId) return;
        jsonRequest("POST", "/api/connect/receiver/cleaning-sessions", {
          cleaningCompletedAt: completed ? new Date().toISOString() : "",
          cleaningStartedAt: receiverState.cleaningStartedAt,
          mainConnectUserPersonId: receiverState.personId,
          message: completed ? "Classic WebView screen cleaning completed." : "Classic WebView screen cleaning started.",
          receiverDeviceId: receiverState.receiverDeviceId,
          receiverInstallId: receiverState.receiverInstallId,
          receiverMode: "classic_webview",
          sessionId: receiverState.cleaningSessionId
        }, function () {});
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
      startReceiverGuideSync();
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
      connectNativeReceiver(function (binding) {
        if (!binding) return;
        showScreen("homeScreen");
        loadAppointments();
        loadTodayFocus();
        loadMessages();
        startIncomingCallPolling();
      });
      window.setInterval(function () {
        if (!receiverState.receiverDeviceId) return;
        connectNativeReceiver(function (binding) {
          if (!binding) return;
          loadAppointments();
          loadTodayFocus();
          loadMessages();
          startIncomingCallPolling();
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
