export const ENVIRONMENTS = {
  mission: {
    id: 'mission',
    code: 'MISSION OPS',
    name: 'Mission Operations',
    description: 'Distributed ground, telemetry, command, and tracking services supporting a high-consequence mission environment.',
    objective: 'Protect telemetry continuity, service redundancy, and mission readiness.',
    metricLabels: {
      latency: ['LATENCY', 'TELEMETRY GATEWAY'],
      packetLoss: ['PACKET LOSS', 'GROUND LINK'],
      compute: ['COMPUTE', 'MISSION SERVICES'],
      throughput: ['THROUGHPUT', 'EVENT STREAM']
    },
    assets: [
      { id: 'TEL-GW-01', name: 'Telemetry Gateway', type: 'service' },
      { id: 'CMD-01', name: 'Command Service', type: 'service' },
      { id: 'TRACK-01', name: 'Tracking Service', type: 'service' },
      { id: 'GS-A', name: 'Ground Station A', type: 'ground-link' },
      { id: 'GS-B', name: 'Ground Station B', type: 'ground-link' },
      { id: 'MDB-01', name: 'Mission Database', type: 'data' }
    ]
  },
  factory: {
    id: 'factory',
    code: 'FACTORY OPS',
    name: 'Factory Operations',
    description: 'Simulated manufacturing systems spanning equipment interfaces, process control, production tracking, and quality telemetry.',
    objective: 'Protect equipment availability, production flow, and process visibility.',
    metricLabels: {
      latency: ['LATENCY', 'CONTROL BUS'],
      packetLoss: ['PACKET LOSS', 'EQUIPMENT LINK'],
      compute: ['COMPUTE', 'CONTROL NODE'],
      throughput: ['THROUGHPUT', 'EVENT INGEST']
    },
    assets: [
      { id: 'LITH-01', name: 'Lithography Tool', type: 'equipment' },
      { id: 'ETCH-01', name: 'Etch Tool', type: 'equipment' },
      { id: 'DEP-01', name: 'Deposition Tool', type: 'equipment' },
      { id: 'MET-01', name: 'Metrology Tool', type: 'equipment' },
      { id: 'AMHS-01', name: 'Material Handling', type: 'automation' },
      { id: 'MES-01', name: 'MES Gateway', type: 'service' }
    ]
  }
};

export const listEnvironments = () => Object.values(ENVIRONMENTS);
export const getEnvironment = (id) => ENVIRONMENTS[id] || null;
