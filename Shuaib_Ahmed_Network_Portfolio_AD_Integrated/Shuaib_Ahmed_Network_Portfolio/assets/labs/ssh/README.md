# Cisco SSH Lab: Device Recovery, Management IP Bring-Up, and Validation

This document captures the lab process used to recover password-protected Cisco devices, assign management IP addresses, and establish SSH access from a Windows PC. It is written as a repo-ready GitHub lab record intended for both future self-reference and employer-facing documentation.

---

## 1. Lab Objective

Recover access to previously owned or inherited networking devices that already had passwords configured, standardize management addressing on a dedicated lab subnet, and validate SSH reachability from a local Windows host.

**Primary objective:** establish reliable SSH management access to the lab devices.

---

## 2. Confirmed Lab Facts

The following items are confirmed from this lab history and the topology image in this conversation:

- The management subnet used for SSH was **192.168.10.0/24**.
- The PC used for testing was assigned **192.168.10.20/24**.
- The lab devices were assigned the following management IPs:
  - **R1:** 192.168.10.1
  - **R2:** 192.168.10.2
  - **R3:** 192.168.10.3
  - **FW1:** 192.168.10.4
  - **SW1:** 192.168.10.10
- The devices initially had unknown credentials, so recovery/reset work was required before SSH could be configured.
- The switch management IP was placed on an SVI.
- The routers were assigned management IPs directly on their connected routed interfaces.
- The firewall was assigned a management IP for SSH access.

**Important troubleshooting fact preserved from this lab history:** a duplicate-IP condition was encountered in testing when a router interface and the Windows PC shared the same IP address. That caused SSH attempts to hit the PC itself rather than the router. Every management IP in this lab must therefore remain unique.

---

## 3. Lab Images

### 3.1 Physical Lab Photo

![Physical lab layout](ssh-lab-doc/images/physical-lab.jpg)

**Figure 1.** Physical view of the SSH lab hardware stack.

### 3.2 Logical Topology

![Logical SSH topology](ssh-lab-doc/images/logical-topology.png)

**Figure 2.** Logical topology and management addressing plan for the SSH lab.

---

## 4. Scope Notes and Precision Boundaries

This write-up distinguishes between:

1. **Confirmed lab facts** from the conversation and topology image.
2. **Platform-common Cisco recovery and SSH commands** that match the lab objective.
3. **Model-dependent items** that must be adjusted if the exact chassis or interface names differ.

That distinction matters because the exact password-recovery sequence is not identical across all Cisco platforms.

Examples:

- An **ISR router** typically uses a ROMMON-based config-register bypass workflow.
- A **Catalyst switch** commonly uses flash initialization and config-file rename/recovery.
- An **ASA firewall** uses ASA-specific interface naming and SSH authorization syntax.

Where an interface name may vary by model, this document explicitly says so instead of pretending certainty.

---

## 5. Topology Summary

The logical management network was a single flat subnet used to bring all devices under SSH control.

### 5.1 Management Addressing Plan

| Device | Role | Management IP | Notes |
|---|---|---:|---|
| R1 | Router | 192.168.10.1 | SSH target |
| R2 | Router | 192.168.10.2 | SSH target |
| R3 | Router | 192.168.10.3 | SSH target |
| FW1 | Firewall | 192.168.10.4 | SSH target |
| SW1 | Switch | 192.168.10.10 | Switch SVI management IP |
| PC1 | Windows test host | 192.168.10.20 | Local source for ping and SSH |

### 5.2 Design Interpretation

The topology image shows additional physical/logical links among routers that were part of the broader lab environment. For the **initial SSH bring-up**, the critical requirement was simpler:

- each device needed a **unique reachable management IP**, and
- the Windows PC needed to be in the **same subnet** for first-hop testing.

Any additional routing links shown in the topology were not required to be fully routed for the first SSH validation phase.

---

## 6. High-Level Procedure

The lab was built in the following sequence:

1. **Console into each device**.
2. **Determine that the device was password-protected** and not readily accessible.
3. **Recover or bypass the existing configuration/credential barrier**.
4. **Assign a clean management IP** on the 192.168.10.0/24 lab subnet.
5. **Create a local administrative account**.
6. **Generate RSA keys**.
7. **Enable SSH version 2**.
8. **Restrict VTY access to SSH**.
9. **Validate with ping and SSH from the Windows PC**.
10. **Save the configuration**.

---

## 7. Password Recovery / Initial Access Recovery

## 7.1 Router Recovery (IOS / IOS-XE Pattern)

Use this when the router boots with unknown credentials and you need to bypass the startup configuration long enough to regain privileged access.

### Recovery sequence

1. Connect via console.
2. Reload or power-cycle the router.
3. Send a **break** sequence from the terminal emulator during boot.
4. Enter **ROMMON**.
5. Change the configuration register so the startup configuration is ignored during the next boot.
6. Boot the router.
7. Copy the startup configuration into RAM after boot so you can preserve useful config while replacing credentials.
8. Restore the normal config-register value.

### Router recovery commands

```text
rommon 1 > confreg 0x2142
rommon 2 > reset
```

After the router boots:

```text
Router> enable
Router# copy startup-config running-config
Router# configure terminal
Router(config)# config-register 0x2102
Router(config)# no enable secret
Router(config)# username admin privilege 15 secret <STRONG_PASSWORD>
Router(config)# end
Router# write memory
```

### Notes

- `0x2142` tells the router to ignore the startup configuration on boot.
- `0x2102` restores normal boot behavior.
- If the device had configuration you wanted to preserve, `copy startup-config running-config` was the critical recovery step.
- Replace `admin` and `<STRONG_PASSWORD>` with your actual chosen credentials.

> **Insert console screenshot here:** ROMMON entry and config-register recovery on router.

---

## 7.2 Catalyst Switch Recovery (Common 3650-Style Workflow)

Use this when the switch is password-protected and you need to rename the startup configuration so the switch can boot without loading it.

### Recovery sequence

1. Connect via console.
2. Reload or power-cycle the switch.
3. Interrupt boot and enter the switch recovery prompt.
4. Initialize flash.
5. Rename the saved config file.
6. Boot the switch.
7. Optionally merge the old configuration back into RAM after regaining access.

### Switch recovery commands

```text
switch: flash_init
switch: dir flash:
switch: rename flash:config.text flash:config.text.old
switch: boot
```

After the switch boots:

```text
Switch> enable
Switch# copy flash:config.text.old system:running-config
Switch# configure terminal
Switch(config)# username admin privilege 15 secret <STRONG_PASSWORD>
Switch(config)# end
Switch# write memory
```

### Notes

- `flash:config.text` is the common startup config filename on many Catalyst platforms.
- Some models may store boot metadata differently, but the recovery principle is the same: **prevent the protected config from loading, regain access, then selectively re-apply what you need**.
- If the old configuration was not needed, you could rebuild from scratch instead of merging it back.

> **Insert console screenshot here:** switch recovery prompt and flash rename step.

---

## 7.3 Firewall Recovery (Platform-Dependent)

The topology includes **FW1** with management IP **192.168.10.4**. The exact password recovery process depends on the firewall platform and software family.

Because the logical diagram uses generic labels (`Port0`, `Port1`) rather than a chassis-specific ASA interface map, this section records the **SSH configuration pattern** rather than claiming an exact reset procedure that cannot be proven from the conversation alone.

If the firewall was an **ASA-style platform**, the common SSH baseline would look like this after privileged access was recovered.

```text
ciscoasa> enable
ciscoasa# configure terminal
ciscoasa(config)# username admin password <STRONG_PASSWORD> privilege 15
ciscoasa(config)# aaa authentication ssh console LOCAL
ciscoasa(config)# crypto key generate rsa modulus 2048
ciscoasa(config)# ssh version 2
```

Management interface example:

```text
ciscoasa(config)# interface management0/0
ciscoasa(config-if)# nameif mgmt
ciscoasa(config-if)# security-level 100
ciscoasa(config-if)# ip address 192.168.10.4 255.255.255.0
ciscoasa(config-if)# no shutdown
ciscoasa(config-if)# exit
ciscoasa(config)# ssh 192.168.10.0 255.255.255.0 mgmt
ciscoasa(config)# write memory
```

### Notes

- If your firewall used a **data interface** rather than `management0/0`, substitute the correct interface name.
- On ASA, SSH access is not enabled solely by creating a username; you must also authorize the source subnet with the `ssh` command.
- The interface label in your drawing should remain the source of truth for logical cabling, while the actual CLI interface name must be verified on the firewall itself.

> **Insert console screenshot here:** firewall SSH configuration and interface IP assignment.

---

## 8. Management IP Configuration

Once privileged access was recovered, the next step was to assign device IPs for SSH.

## 8.1 Router Interface IPs

The following blocks reflect the addressing plan shown in the topology. Replace the interface name only if your physical cabling used a different router port.

### R1

```text
configure terminal
hostname R1
interface gigabitEthernet0/0/0
 ip address 192.168.10.1 255.255.255.0
 no shutdown
exit
```

### R2

```text
configure terminal
hostname R2
interface gigabitEthernet0/0/0
 ip address 192.168.10.2 255.255.255.0
 no shutdown
exit
```

### R3

```text
configure terminal
hostname R3
interface gigabitEthernet0/0/0
 ip address 192.168.10.3 255.255.255.0
 no shutdown
exit
```

### Notes

- The topology labels indicate that the routers had multiple interfaces connected in the wider lab.
- For SSH bring-up, the management-facing interface was the one given the 192.168.10.x address.
- Do **not** duplicate the PC IP on any router interface.

> **Insert console screenshot here:** router interface IP assignment and `show ip interface brief`.

---

## 8.2 Switch Management SVI

The switch was managed through an SVI using **192.168.10.10/24**.

```text
configure terminal
hostname SW1
interface vlan 1
 ip address 192.168.10.10 255.255.255.0
 no shutdown
exit
```

Optional default gateway for future off-subnet management:

```text
ip default-gateway <gateway-on-192.168.10.0/24>
```

### Notes

- For **same-subnet local SSH testing**, a default gateway is not required.
- A default gateway becomes necessary when the switch must be managed **from another subnet**.
- VLAN 1 was acceptable for this initial lab. In a production network, a dedicated management VLAN is preferred.

> **Insert console screenshot here:** SVI configuration and `show ip interface brief` on SW1.

---

## 8.3 Windows Test Host Addressing

The Windows PC used for testing was assigned **192.168.10.20/24**.

### PowerShell example

```powershell
Get-NetAdapter
New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress 192.168.10.20 -PrefixLength 24
```

If a previous conflicting static address already existed, remove it first:

```powershell
Get-NetIPAddress -InterfaceAlias "Ethernet"
Remove-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress <OLD_IP> -Confirm:$false
```

### Notes

- A default gateway is not required for local testing to devices in the same subnet.
- If DHCP was previously active, verify that Windows is no longer using an unintended address.
- Use `ipconfig` after configuration to confirm the PC is actually on 192.168.10.20/24.

> **Insert screenshot here:** Windows `ipconfig` or PowerShell address assignment output.

---

## 9. SSH Configuration

After IP addressing, SSH was enabled on the Cisco devices.

## 9.1 IOS / IOS-XE SSH Baseline (Routers and Switch)

Apply the following on each IOS / IOS-XE device after its management IP is in place.

```text
configure terminal
ip domain name lab.local
username admin privilege 15 secret <STRONG_PASSWORD>
crypto key generate rsa modulus 2048
ip ssh version 2
line vty 0 15
 login local
 transport input ssh
exit
end
write memory
```

### Why each command matters

- `ip domain name lab.local` is required because the RSA keypair generation uses the hostname + domain name combination.
- `username admin privilege 15 secret ...` creates the local credential used by SSH.
- `crypto key generate rsa modulus 2048` generates the key material required for SSH.
- `ip ssh version 2` forces SSHv2.
- `login local` tells the VTY lines to use the local username database.
- `transport input ssh` disables Telnet and allows only SSH.

> **Insert console screenshot here:** SSH baseline config on a router or switch.

---

## 9.2 Device-Specific Post-Config Checks

### Routers / Switch

```text
show ip interface brief
show running-config | section line vty
show ip ssh
show crypto key mypubkey rsa
```

### ASA-style firewall

```text
show interface ip brief
show running-config ssh
show running-config aaa
show ssh
```

---

## 10. Validation from the PC

The final step was to verify layer-3 reachability and then test SSH.

## 10.1 Ping Tests

```powershell
ping 192.168.10.1
ping 192.168.10.2
ping 192.168.10.3
ping 192.168.10.4
ping 192.168.10.10
```

Expected result: successful replies from all assigned management IPs.

## 10.2 Initial SSH Test Behavior Observed in This Lab

A critical real-world detail from this lab is that the **default modern OpenSSH client syntax** was **not sufficient for every device**.

These initial commands were attempted from Windows PowerShell:

```powershell
ssh admin@192.168.10.10
ssh admin@192.168.10.4
```

Those attempts failed because the Windows OpenSSH client and the legacy crypto offered by some Cisco devices did not fully overlap.

### Actual switch error observed

```text
PS C:\WINDOWS\system32> ssh admin@192.168.10.10
Unable to negotiate with 192.168.10.10 port 22: no matching key exchange method found. Their offer: diffie-hellman-group-exchange-sha1,diffie-hellman-group14-sha1
```

### Actual firewall error observed

```text
PS C:\WINDOWS\system32> ssh admin@192.168.10.4
Unable to negotiate with 192.168.10.4 port 22: no matching host key type found. Their offer: ssh-rsa
```

This means the lab did establish SSH service on the devices, but the client needed **explicit compatibility options** to connect.

## 10.3 Correct Windows OpenSSH Compatibility Commands

### Switch compatibility command

For the switch, Windows OpenSSH needed the legacy SHA-1-based key-exchange algorithms enabled:

```powershell
ssh -o KexAlgorithms=+diffie-hellman-group14-sha1,diffie-hellman-group-exchange-sha1 admin@192.168.10.10
```

If a later negotiation step also complains about host key type, use the broader legacy-compatible form:

```powershell
ssh -o KexAlgorithms=+diffie-hellman-group14-sha1,diffie-hellman-group-exchange-sha1 -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa admin@192.168.10.10
```

### Firewall compatibility command

For the firewall, Windows OpenSSH needed the RSA host-key algorithm explicitly re-enabled:

```powershell
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa admin@192.168.10.4
```

## 10.4 Recommended SSH Validation Sequence

Use the following order during validation:

1. Test standard syntax first.
2. If negotiation fails, read the exact error text carefully.
3. Add only the legacy option required by that error.
4. Re-test and document which compatibility flag was required for that platform.

### Examples from this lab

#### Routers

```powershell
ssh admin@192.168.10.1
ssh admin@192.168.10.2
ssh admin@192.168.10.3
```

#### Switch

```powershell
ssh -o KexAlgorithms=+diffie-hellman-group14-sha1,diffie-hellman-group-exchange-sha1 admin@192.168.10.10
```

#### Firewall

```powershell
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedAlgorithms=+ssh-rsa admin@192.168.10.4
```

Expected result: password prompt and successful CLI login after algorithm compatibility is satisfied.

> **Insert screenshot here:** successful SSH login from Windows terminal.

---

## 11. Critical Troubleshooting Lessons from This Lab

## 11.1 Duplicate IP = You SSH Into Yourself

A key failure mode encountered in this broader lab effort was an IP conflict in which a router interface and the Windows PC shared the same IP address.

### Symptom pattern

- SSH to the expected router IP failed or behaved strangely.
- Ping replies showed **Windows-like TTL behavior** instead of the expected device response.
- `arp -a` and local interface output indicated the target IP was actually owned by the PC itself.

### Practical conclusion

If the PC is configured as **192.168.10.20**, then **no Cisco device in the lab can also use 192.168.10.20**.

That sounds obvious, but this issue can waste a large amount of troubleshooting time because the target IP appears superficially correct while actually resolving to the local machine.

---

## 11.2 Interface Up/Down State Matters

If SSH is configured correctly but the interface is administratively down, the device will still be unreachable.

Always verify:

```text
show ip interface brief
```

Look specifically for:

- correct IP address
- `up/up` state
- correct management interface/SVI

---

## 11.3 SSH Requires More Than an IP Address

A Cisco device can have a valid IP address and still reject SSH if any of the following are missing:

- local username
- RSA keys
- `ip ssh version 2`
- `login local` under VTY lines
- `transport input ssh`

For an ASA-style firewall, SSH also requires explicit source authorization:

```text
ssh 192.168.10.0 255.255.255.0 <interface-name>
```

Even when all of that is configured correctly, a modern SSH client can still fail if the device only offers older cryptographic algorithms. In this lab, that specifically appeared as:

- legacy **Diffie-Hellman SHA-1 key-exchange** requirements on the switch, and
- legacy **`ssh-rsa` host key** requirements on the firewall.

So the full troubleshooting model is:

1. verify IP reachability,
2. verify device-side SSH configuration, and
3. verify client/device crypto compatibility.

---

## 11.4 Same-Subnet Testing Simplifies First Bring-Up

Using a single flat management subnet for the first phase of SSH validation removes multiple variables at once:

- no inter-VLAN routing dependency
- no static route dependency
- no default gateway dependency for same-subnet pings and SSH

That made this a good first milestone before expanding into larger routed lab designs.

---

## 12. Suggested Final Running Config Pattern

Below is the compact final pattern for an IOS / IOS-XE device after recovery.

```text
hostname <DEVICE_NAME>
!
interface <MGMT_INTERFACE>
 ip address <DEVICE_IP> 255.255.255.0
 no shutdown
!
ip domain name lab.local
username admin privilege 15 secret <STRONG_PASSWORD>
crypto key generate rsa modulus 2048
ip ssh version 2
!
line vty 0 15
 login local
 transport input ssh
!
end
write memory
```

Examples from this lab:

- `R1` → `192.168.10.1`
- `R2` → `192.168.10.2`
- `R3` → `192.168.10.3`
- `SW1` SVI → `192.168.10.10`

---

## 13. Rebuild Checklist

Use this sequence any time the lab must be rebuilt from scratch.

### Recovery

- Connect console cable.
- Confirm the device is password-protected.
- Enter the correct recovery mode for the platform.
- Recover or bypass the saved configuration.
- Restore privileged access.

### Management IPs

- Assign a unique management IP.
- Verify the subnet mask is `255.255.255.0` (`/24`).
- Bring the interface or SVI up with `no shutdown`.
- Verify addressing and state with `show ip interface brief`.

### SSH

- Set hostname.
- Set domain name.
- Create the local admin user.
- Generate RSA keys.
- Enable SSHv2.
- Set VTY lines to `login local`.
- Restrict inbound VTY transport to SSH.
- Save the configuration.

### Validation

- Confirm the Windows NIC is `192.168.10.20/24`.
- Ping each management IP.
- Test SSH to each device.
- If SSH negotiation fails, apply the required compatibility option.
- Confirm there are no duplicate IP addresses.

---

## 14. Final Summary

This lab established a clean repeatable process for bringing used or locked Cisco devices under management control:

- recover console access,
- standardize management addressing,
- enable SSH correctly,
- validate from a known-good Windows host,
- and preserve lessons learned from real troubleshooting.

The most important practical outcomes were:

1. **unknown passwords were removed as a blocker**,
2. **management IPs were standardized on 192.168.10.0/24**,
3. **SSH access was established**, and
4. **duplicate-IP mistakes were identified as a critical failure mode to avoid in future builds**.

