export const ENVIRONMENTS = {
  mission: {
    id: 'mission',
    code: 'MISSION OPS',
    name: 'Mission Operations',
    description: 'Distributed ground, telemetry, command, tracking, network, and data services supporting a high-consequence mission environment.',
    objective: 'Protect telemetry continuity, service redundancy, dependency integrity, and mission readiness.',
    metricLabels: {
      latency: ['LATENCY', 'TELEMETRY GATEWAY'],
      packetLoss: ['PACKET LOSS', 'GROUND LINK'],
      compute: ['COMPUTE', 'MISSION SERVICES'],
      throughput: ['THROUGHPUT', 'EVENT STREAM']
    },
    flow: ['GS-A', 'TEL-GW-01', 'NET-CORE-01', 'MDB-01'],
    assets: [
      { id: 'GS-A', name: 'Ground Station A', type: 'ground-link', nominalState: 'PRIMARY', redundancyGroup: 'ground-link' },
      { id: 'GS-B', name: 'Ground Station B', type: 'ground-link', nominalState: 'STANDBY', redundancyGroup: 'ground-link' },
      { id: 'TEL-GW-01', name: 'Telemetry Gateway A', type: 'service', nominalState: 'READY', redundancyGroup: 'telemetry-gateway', dependsOn: ['GS-A', 'GS-B'] },
      { id: 'TEL-GW-02', name: 'Telemetry Gateway B', type: 'service', nominalState: 'STANDBY', redundancyGroup: 'telemetry-gateway', dependsOn: ['GS-A', 'GS-B'] },
      { id: 'NET-CORE-01', name: 'Mission Network Core', type: 'network', nominalState: 'READY', dependsOnAny: ['TEL-GW-01', 'TEL-GW-02'] },
      { id: 'TRACK-01', name: 'Tracking Service', type: 'service', nominalState: 'READY', dependsOn: ['NET-CORE-01'], dependsOnAny: ['TEL-GW-01', 'TEL-GW-02'] },
      { id: 'CMD-01', name: 'Command Service', type: 'service', nominalState: 'READY', dependsOn: ['NET-CORE-01', 'MDB-01'] },
      { id: 'MDB-01', name: 'Mission Database', type: 'data', nominalState: 'READY' }
    ]
  },
  factory: {
    id: 'factory',
    code: 'FACTORY OPS',
    name: 'Factory Operations',
    description: 'Simulated manufacturing systems spanning equipment interfaces, material movement, production tracking, and process telemetry.',
    objective: 'Protect equipment availability, production flow, and process visibility.',
    metricLabels: {
      latency: ['LATENCY', 'CONTROL BUS'],
      packetLoss: ['PACKET LOSS', 'EQUIPMENT LINK'],
      compute: ['COMPUTE', 'CONTROL NODE'],
      throughput: ['THROUGHPUT', 'EVENT INGEST']
    },
    flow: ['LITH-01', 'ETCH-01', 'DEP-01', 'MET-01'],
    assets: [
      { id: 'LITH-01', name: 'Lithography Tool', type: 'equipment', nominalState: 'IDLE', lifecycle: ['OFFLINE', 'IDLE', 'SETUP', 'RUNNING', 'COMPLETE'] },
      { id: 'ETCH-01', name: 'Etch Tool', type: 'equipment', nominalState: 'IDLE', lifecycle: ['OFFLINE', 'IDLE', 'SETUP', 'RUNNING', 'COMPLETE'] },
      { id: 'DEP-01', name: 'Deposition Tool', type: 'equipment', nominalState: 'IDLE', lifecycle: ['OFFLINE', 'IDLE', 'SETUP', 'RUNNING', 'COMPLETE'] },
      { id: 'MET-01', name: 'Metrology Tool', type: 'equipment', nominalState: 'IDLE', lifecycle: ['OFFLINE', 'IDLE', 'SETUP', 'RUNNING', 'COMPLETE'] },
      { id: 'AMHS-01', name: 'Material Handling', type: 'automation', nominalState: 'READY' },
      { id: 'MES-01', name: 'MES Gateway', type: 'service', nominalState: 'READY' }
    ]
  }
};

export const listEnvironments = () => Object.values(ENVIRONMENTS);
export const getEnvironment = (id) => ENVIRONMENTS[id] || null;
