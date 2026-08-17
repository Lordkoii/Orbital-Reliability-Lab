export const SCENARIOS = [
  {
    id: 'mission-ground-link-degradation', environment: 'mission', name: 'Ground Link Degradation',
    summary: 'Primary ground link develops severe packet loss and telemetry delay.', faultType: 'packet_loss', target: 'GS-A',
    response: 'Detect link degradation, fail over to the redundant station, then validate telemetry continuity.'
  },
  {
    id: 'mission-telemetry-gateway-outage', environment: 'mission', name: 'Telemetry Gateway Outage',
    summary: 'The primary telemetry gateway becomes unavailable during operations.', faultType: 'service_down', target: 'TEL-GW-01',
    response: 'Detect service loss, expose downstream impact, restore the gateway, and validate event flow.'
  },
  {
    id: 'mission-compute-saturation', environment: 'mission', name: 'Mission Compute Saturation',
    summary: 'Mission command services experience compute saturation and processing slowdown.', faultType: 'cpu_spike', target: 'CMD-01',
    response: 'Detect resource exhaustion, isolate the service, recover capacity, and validate command readiness.'
  },
  {
    id: 'factory-equipment-link-loss', environment: 'factory', name: 'Metrology Link Loss',
    summary: 'Metrology equipment communication becomes unreliable during production.', faultType: 'packet_loss', target: 'MET-01',
    response: 'Detect communication loss, place affected quality flow on hold, recover connectivity, and validate data flow.'
  },
  {
    id: 'factory-mes-gateway-outage', environment: 'factory', name: 'MES Gateway Outage',
    summary: 'Production tracking acknowledgements stop when the MES gateway fails.', faultType: 'service_down', target: 'MES-01',
    response: 'Detect the gateway outage, hold equipment execution, restore the service, and validate event delivery.'
  },
  {
    id: 'factory-control-node-saturation', environment: 'factory', name: 'Material Handling Saturation',
    summary: 'The material-handling control node saturates and delays equipment delivery.', faultType: 'cpu_spike', target: 'AMHS-01',
    response: 'Detect compute saturation, block new moves, recover capacity, and validate production flow.'
  }
];

export const getScenarios = (environment) => SCENARIOS.filter((scenario) => !environment || scenario.environment === environment);
export const getScenario = (id) => SCENARIOS.find((scenario) => scenario.id === id) || null;
