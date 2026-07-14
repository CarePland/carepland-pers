# Receiver Modern Experiment

Receiver Modern is an experimental tablet-first presentation layer for the hosted React Receiver. It exists alongside Receiver Classic and does not replace appliance-oriented Receiver layouts.

## Purpose

Receiver Classic remains optimized for seniors, cognitive accessibility, dedicated appliances, assisted living, and large-touch appliance use. Receiver Modern explores the same Receiver workflows for adult children, family caregivers, tech-comfortable adults, self-use, browsers, tablets, and larger phones.

## Design Philosophy

Receiver Modern preserves CarePland's platform principle: users express intent, and CarePland determines workflow, routing, and data model while preserving transparency through Decision Trace.

The experience should feel calm, intelligent, and immediately approachable. Ask/Tell remains the visual and conceptual center. The primary layout target is a 4:3 tablet proportion, similar to an iPad: Goals, Next Appointment, and one Receiver Notification live in a left context column; Ask/Tell lives in the right primary column; Messages, Review, Sound, and Clean Screen sit in a bottom action bar.

Receiver Modern must not become a chat application, admin dashboard, settings screen, email client, or backend concept browser. It should expose what the user can do now, not how the system is implemented.

## Switching

Use `receiverLayout=modern` on the Receiver URL to open Receiver Modern. The Modern header includes a `Classic` button that removes the modern layout selection. The existing Receiver Classic layout remains the default.

## Boundaries

Receiver Modern is presentation-only. It must not change APIs, data models, provisioning, Receiver authorization, CCKL, HKL, Intent Router, Decision Trace, or existing workflows.
