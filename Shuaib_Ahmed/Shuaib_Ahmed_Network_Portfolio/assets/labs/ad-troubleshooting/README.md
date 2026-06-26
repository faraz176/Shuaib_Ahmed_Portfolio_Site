# Active Directory Secure-Channel and DNS Troubleshooting Lab

## Executive summary

This lab documents the recovery of a Windows 11 client that could not reliably communicate with an Active Directory domain after its domain trust relationship became unhealthy. Basic IP connectivity to the domain controller was available, but domain operations continued to fail. The troubleshooting process isolated the problem to the Active Directory control plane rather than the physical network: DNS-based domain-controller discovery, client DNS configuration, and stale machine-account state were treated as likely contributing factors.

The client was removed from the domain, returned to a workgroup, cleaned up in Active Directory, configured to use the domain controller as its DNS server, and then rejoined to `lab.local`. Final validation confirmed that the active Windows session was `LAB\faraz`, the client was joined to `lab.local`, and the `LAB\Forti_Guests` group was enabled in the logged-in user's security token.

## Problem statement

A Windows 11 Enterprise client named `DESKTOP-IO53IGD` needed to authenticate against the `lab.local` Active Directory domain so it could later participate in identity-aware FortiGate policy testing. The client had previously been domain joined, but its secure channel was no longer healthy. Repair attempts failed even though the client could ping the domain controller.

This created an important troubleshooting distinction:

- Layer 3 reachability to the server was present.
- Active Directory operations still failed.
- The failure therefore had to be investigated at the identity, DNS, and domain-discovery layers.

## Lab environment

| Component | Value |
|---|---|
| Hypervisor | VMware Workstation Pro |
| Domain controller hostname | `WIN-C1TGH1EHM2H` |
| Active Directory domain | `lab.local` |
| Domain controller / DNS IPv4 | `192.168.1.96` |
| Windows 11 client hostname | `DESKTOP-IO53IGD` |
| Primary test identity | `LAB\faraz` |
| Comparison identity | `LAB\employee_test` |
| AD security group | `LAB\Forti_Guests` |

## Intended identity design

The test accounts were intentionally placed into different groups so later FortiGate identity-aware controls could distinguish them:

| User | Group membership |
|---|---|
| `faraz` | `Domain Users`, `Forti_Guests` |
| `employee_test` | `Domain Users` only |

The `Forti_Guests` group provides a clean authorization boundary for a later FSSO lab. The eventual goal is to observe whether firewall behavior changes based on the authenticated user's AD group membership.

## Initial symptoms

The Windows 11 client had an unhealthy trust relationship with the domain. The initial secure-channel check returned `False`:

```powershell
Test-ComputerSecureChannel -Verbose
```

Repair attempts did not restore the relationship:

```powershell
Reset-ComputerMachinePassword `
    -Server 192.168.1.96 `
    -Credential LAB\Administrator

Test-ComputerSecureChannel `
    -Repair `
    -Credential LAB\Administrator `
    -Verbose
```

A forced workgroup transition was used so the client could be cleanly rejoined:

```powershell
Remove-Computer -WorkgroupName WORKGROUP -Force -Restart
```

A later domain-join attempt still failed with a domain-contact error. This was useful evidence because it showed that a basic ping test was not enough to prove that AD discovery was functioning correctly.

## Diagnostic reasoning

### 1. Confirm the domain controller was healthy enough to continue

The domain controller was checked with:

```powershell
dcdiag
```

Core Active Directory tests passed, including connectivity, advertising, SYSVOL, machine-account, NetLogons, replication, services, and locator checks. Secondary warnings did not justify rebuilding the server.

### 2. Separate IP reachability from AD reachability

The client could ping `192.168.1.96`, which proved that packets could reach the server. However, Active Directory relies heavily on DNS records and domain-controller discovery. A successful ICMP echo reply does not prove that the client can discover LDAP, Kerberos, and other AD services correctly.

### 3. Investigate DNS behavior

The Windows 11 client showed DNS pollution from the home-router path. The remediation strategy was to temporarily remove IPv6 from the troubleshooting path and force the client to use only the AD DNS server:

```powershell
Disable-NetAdapterBinding -Name "Ethernet0" -ComponentID ms_tcpip6
Set-DnsClientServerAddress -InterfaceAlias "Ethernet0" -ServerAddresses 192.168.1.96
Clear-DnsClientCache
```

The DC was also configured with public DNS forwarders so it could resolve external names while remaining the authoritative internal DNS service for the lab:

```text
8.8.8.8
1.1.1.1
```

### 4. Remove stale machine-account state

The stale `DESKTOP-IO53IGD` object was removed from the `Computers` container in Active Directory Users and Computers before the new domain join. This prevented the rejoin attempt from depending on an unhealthy prior machine-account relationship.

### 5. Verify domain-controller discovery

The client-side validation sequence was:

```powershell
Get-DnsClientServerAddress -InterfaceAlias "Ethernet0"
Resolve-DnsName win-c1tgh1ehm2h.lab.local
Resolve-DnsName _ldap._tcp.dc._msdcs.lab.local -Type SRV
nltest /dsgetdc:lab.local
```

The SRV lookup is particularly important. Active Directory clients do not simply look for a server by IP address. They query DNS for service records that advertise domain controllers and services such as LDAP.

## Remediation procedure

The final remediation sequence was:

1. Remove the stale `DESKTOP-IO53IGD` computer object from the AD `Computers` container.
2. Temporarily disable IPv6 on the Windows 11 test adapter.
3. Configure the Windows 11 client to use only `192.168.1.96` for DNS.
4. Clear the DNS client cache.
5. Verify host and SRV records for `lab.local`.
6. Rejoin the domain without forcing a specific server parameter:

```powershell
Add-Computer `
    -DomainName lab.local `
    -Credential LAB\Administrator `
    -Verbose `
    -Restart
```

7. Log in as:

```text
LAB\faraz
```

## Validation results

The available final evidence confirms:

```powershell
whoami
```

```text
lab\faraz
```

The logged-in user token also contains:

```powershell
whoami /groups | Select-String "Domain Users|Forti_Guests"
```

```text
LAB\Forti_Guests
Mandatory group, Enabled by default, Enabled group
```

A separate PowerShell check performed during the session confirmed that `DESKTOP-IO53IGD` was joined to `lab.local` with `PartOfDomain=True`. A single consolidated screenshot of all final checks was not captured, so the report preserves the available validation images and the verified terminal output separately.

## Root-cause statement

The evidence supports a conservative conclusion: the failure was likely caused by a combination of DNS/domain-controller discovery issues and stale machine-account state. The lab does not claim that one isolated fault was proven as the only cause. The remediation removed both likely failure conditions and restored the client to a usable domain-authenticated state.

## Evidence ledger

| File | Evidence value |
|---|---|
| `01-aduc-computer-object.png` | ADUC `Computers` container showing the client machine object before cleanup. |
| `02-ad-group-membership-powershell.png` | PowerShell evidence that `faraz` belongs to `Domain Users` and `Forti_Guests`, while `employee_test` belongs only to `Domain Users`. |
| `03-forti-guests-members-aduc.png` | GUI confirmation that `faraz` is the only member of `Forti_Guests`. |
| `04-client-local-account-baseline.png` | Pre-remediation Windows 11 baseline showing a local client identity and prior network configuration. |
| `05-dns-forwarders.png` | DNS Manager forwarders configured on the DC. |
| `06-remove-computer-failure.png` | Failed workgroup-transition attempt caused by domain-contact problems. |
| `07-add-computer-failure.png` | Failed domain-join attempt from `WORKGROUP`. |
| `08-domain-login-success.png` | Successful `whoami` output: `lab\faraz`. |
| `09-domain-group-token-success.png` | Final token evidence showing enabled `LAB\Forti_Guests` membership. |

## Lessons learned

- A successful ping does not prove Active Directory is healthy.
- AD clients depend on DNS SRV records for domain-controller discovery.
- Domain clients should query the AD DNS service rather than bypass it with public resolvers.
- Cached identity state, stale computer objects, and broken secure channels can survive basic connectivity checks.
- Troubleshooting should proceed from first principles: confirm transport, validate DNS, verify service discovery, clean machine-account state, then retest authentication.

## Future integration

This lab establishes the identity foundation for a later FortiGate FSSO project. The next phase will map authenticated users and AD groups to firewall policies so `LAB\faraz` and `LAB\employee_test` can receive different network access decisions.
