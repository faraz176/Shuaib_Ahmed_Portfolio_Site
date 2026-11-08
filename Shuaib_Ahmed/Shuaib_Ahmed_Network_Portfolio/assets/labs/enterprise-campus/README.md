# Resilient Enterprise Campus Network Lab

## Problem Statement

A growing organization required a scalable campus network that could segment multiple endpoint groups, maintain default-gateway availability, dynamically route between campus and edge layers, and provide redundant simulated ISP connectivity.

## Implemented Solution

- VLAN segmentation for VLANs 10, 20, 30, 40, and 50
- Native/blackhole VLAN 99 on trunks
- Parking VLAN 999 for unused access ports
- Rapid PVST+ with deterministic root placement
- Router-on-a-stick on DIST-RTR1 and DIST-RTR2
- HSRP virtual gateways for each user VLAN
- OSPF area 0 between distribution and edge routing layers
- Dual edge routers connected to a simulated ISP router

## Evidence Included

The evidence set includes access-switch VLAN/trunk validation, distribution-switch Rapid PVST+ validation, distribution-router HSRP/OSPF validation, edge-router route validation, and ISP reachability validation.
