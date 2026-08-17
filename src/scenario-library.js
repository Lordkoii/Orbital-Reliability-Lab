export const SCENARIOS = [
  {
    id: 'mission-ground-link-degradation',
    environment: 'mission',
    name: 'Ground Link Degradation',
    summary: 'Primary ground link develops severe packet loss and telemetry delay.',
    faultType: 'packet_loss',
    target: 'GS-A',
    response: 'Detect link degradation, isolate the primary path, recover, then validate telemetry continuity.'
  },
  {
    id: 'mission-telemetry-gateway-outage',
    environment: 'mission',
    name: 'Telemetry Gateway Outage',
    summary: 'The primary telemetry API becomes unavailable during operations.',
    faultType: 'service_down',
    target: 'TEL-GW-01',
    response: 'Detect service loss, isolate the failed gateway, recover service, and validate event flow.'
  },
  {
    id: 'mission-compute-saturation',
    environment: 'mission',
    name: 'Mission Compute Saturation',
    summary: 'Mission services experience compute saturation and event-processing slowdown.',
    faultType: 'cpu_spike',
    target: 'CMD-01',
    response: 'Detect resource exhaustion, isolate the affected service, recover capacity, and validate latency.'
  },
  {
    id: 'factory-equipment-link-loss',
    environment: 'factory',
    name: 'Equipment Link Loss',
    summary: 'Metrology equipment communication becomes unreliable during production.',
    faultType: 'packet_loss',
    target: 'MET-01',
    response: 'Detect equipment communication loss, isolate the tool interface, recover connectivity, and validate data flow.'
  },
  {
    id: 'factory-mes-gateway-outage',
    environment: 'factory',
    name: 'MES Gateway Outage',
    summary: 'Production tracking acknowledgements stop when the MES gateway fails.',
    faultType: 'service_down',
    target: 'MES-01',
    response: 'Detect the gateway outage, isolate the failed service, restore it, and validate production-event delivery.'
  },
  {
    id: 'factory-control-node-saturation',
    environment: 'factory',
    name: 'Control Node Saturation',
    summary: 'A factory control node reaches critical compute utilization and slows equipment event processing.',
    faultType: 'cpu_spike',
    target: 'AMHS-01',
    response: 'Detect compute saturation, isolate the affected automation domain, recover capacity, and validate throughput.'
  }
];

export const getScenarios = (environment) => SCENARIOS.filter((scenario) => !environment || scenario.environment === environment);
export const getScenario = (id) => SCENARIOS.find((scenario) => scenario.id === id) || null;
