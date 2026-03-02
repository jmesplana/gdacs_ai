/**
 * Operation Type Configurations
 * Defines different humanitarian operation types with specific assessment criteria
 */

export const OPERATION_TYPES = {
  MALARIA_CONTROL: {
    id: 'malaria_control',
    name: 'Malaria Control',
    icon: '🦟',
    description: 'ITN/LLIN distribution, IRS spray campaigns, case management',
    category: 'Vector Control',

    // Risk factors specific to malaria operations
    riskFactors: {
      // Climate and environment
      waterBodies: {
        weight: 0.15,
        label: 'Standing Water / Breeding Sites',
        critical: 'Post-flood conditions increase mosquito breeding by 40-60%'
      },
      temperature: {
        weight: 0.10,
        label: 'Temperature & Humidity',
        critical: 'Optimal mosquito breeding conditions'
      },

      // Supply chain
      coldChain: {
        weight: 0.20,
        label: 'ACT/RDT Storage',
        critical: 'Power outage threatens antimalarial drug efficacy'
      },

      // Timing
      seasonality: {
        weight: 0.15,
        label: 'Transmission Season',
        critical: 'Peak transmission season timing critical for LLIN campaigns'
      }
    },

    // Key supplies needed
    supplies: [
      'Long-Lasting Insecticidal Nets (LLINs)',
      'Artemisinin-based Combination Therapy (ACT)',
      'Rapid Diagnostic Tests (RDTs)',
      'Indoor Residual Spray (IRS) equipment',
      'Larvicides for vector control'
    ],

    // Disaster-specific impacts
    disasterImpacts: {
      'FL': { // Flooding
        severity: 'CRITICAL',
        reason: 'Creates mosquito breeding sites, increases malaria cases by 40-60%',
        mitigationPriority: 'HIGH',
        supplyAdjustment: { ACT: 1.5, RDT: 1.5, LLINs: 1.2 }
      },
      'TC': { // Tropical Cyclone
        severity: 'HIGH',
        reason: 'Infrastructure damage, disrupted supply chains, displaced populations',
        mitigationPriority: 'HIGH',
        supplyAdjustment: { ACT: 1.3, RDT: 1.3 }
      },
      'DR': { // Drought
        severity: 'MEDIUM',
        reason: 'Population migration, reduced access to healthcare',
        mitigationPriority: 'MEDIUM'
      },
      'EQ': { // Earthquake
        severity: 'HIGH',
        reason: 'Facility damage, disrupted cold chain',
        mitigationPriority: 'HIGH'
      }
    },

    // Assessment methodology
    assessmentMethod: 'AMP cLQAS', // Alliance for Malaria Prevention
    coverageTarget: 0.80, // 80% coverage target

    // Digital tools
    digitalTools: [
      'Barcode tracking for supply chain',
      'Mobile data collection (Android BYOD)',
      'Geospatial microplanning',
      'Real-time coverage monitoring'
    ]
  },

  IMMUNIZATION: {
    id: 'immunization',
    name: 'Immunization Campaign',
    icon: '💉',
    description: 'Routine and mass vaccination campaigns (Polio, Measles, COVID-19, etc.)',
    category: 'Preventive Health',

    riskFactors: {
      coldChain: {
        weight: 0.35, // CRITICAL for vaccines
        label: 'Cold Chain Integrity',
        critical: 'Vaccine potency loss within 24-48 hours without refrigeration'
      },
      populationDensity: {
        weight: 0.15,
        label: 'Population Concentration',
        critical: 'Displaced populations in camps need priority vaccination'
      },
      access: {
        weight: 0.25,
        label: 'Road Access & Mobility',
        critical: 'Mobile teams needed if roads impassable'
      },
      security: {
        weight: 0.15,
        label: 'Security for Vaccination Teams',
        critical: 'Safe access to communities essential'
      }
    },

    supplies: [
      'Vaccines (type-specific: OPV, Measles, COVID-19, etc.)',
      'Ice packs and vaccine carriers',
      'Syringes and safety boxes',
      'Cold chain monitoring devices',
      'Registration cards and tally sheets'
    ],

    disasterImpacts: {
      'FL': {
        severity: 'HIGH',
        reason: 'Power outages threaten cold chain, waterborne disease outbreak risk',
        mitigationPriority: 'CRITICAL',
        supplyAdjustment: { icePacks: 2.0, vaccines: 1.3 }
      },
      'TC': {
        severity: 'CRITICAL',
        reason: 'Power grid damage, facility destruction, population displacement',
        mitigationPriority: 'CRITICAL',
        supplyAdjustment: { icePacks: 2.5, vaccines: 1.4 }
      },
      'EQ': {
        severity: 'CRITICAL',
        reason: 'Facility structural damage, power loss, cold chain failure',
        mitigationPriority: 'CRITICAL',
        supplyAdjustment: { icePacks: 2.0, vaccines: 1.5 }
      },
      'DR': {
        severity: 'HIGH',
        reason: 'Malnutrition reduces vaccine efficacy, population migration',
        mitigationPriority: 'MEDIUM',
        supplyAdjustment: { vitaminA: 1.5 }
      },
      'VO': {
        severity: 'MEDIUM',
        reason: 'Air quality issues, ash contamination',
        mitigationPriority: 'MEDIUM'
      }
    },

    assessmentMethod: 'LQAS with cluster sampling',
    coverageTarget: 0.90, // 90% coverage for herd immunity

    digitalTools: [
      'Electronic immunization registry',
      'Cold chain temperature loggers',
      'Mobile vaccination tracking apps',
      'SMS reminder systems'
    ]
  },

  WASH: {
    id: 'wash',
    name: 'Water, Sanitation & Hygiene',
    icon: '💧',
    description: 'Water supply, sanitation facilities, hygiene promotion',
    category: 'Environmental Health',

    riskFactors: {
      waterContamination: {
        weight: 0.30,
        label: 'Water Source Contamination',
        critical: 'Contaminated water leads to cholera, dysentery outbreaks'
      },
      infrastructure: {
        weight: 0.25,
        label: 'Water/Sanitation Infrastructure',
        critical: 'Damaged wells, latrines, treatment plants'
      },
      populationDensity: {
        weight: 0.20,
        label: 'Population Density',
        critical: 'Overcrowding in camps increases disease transmission'
      },
      diseaseOutbreak: {
        weight: 0.15,
        label: 'Waterborne Disease Risk',
        critical: 'Post-disaster cholera/typhoid outbreak potential'
      }
    },

    supplies: [
      'Water purification tablets',
      'Portable water filters',
      'Jerrycans and water storage',
      'Hygiene kits (soap, sanitary products)',
      'Chlorine for water treatment',
      'Latrine construction materials'
    ],

    disasterImpacts: {
      'FL': {
        severity: 'CRITICAL',
        reason: 'Widespread water contamination, destroyed sanitation facilities',
        mitigationPriority: 'CRITICAL',
        supplyAdjustment: { purificationTablets: 3.0, jerrycans: 2.0, chlorine: 2.5 }
      },
      'TC': {
        severity: 'CRITICAL',
        reason: 'Infrastructure destruction, contaminated water sources',
        mitigationPriority: 'CRITICAL',
        supplyAdjustment: { purificationTablets: 2.5, jerrycans: 2.0 }
      },
      'EQ': {
        severity: 'HIGH',
        reason: 'Broken water pipes, damaged treatment plants',
        mitigationPriority: 'HIGH',
        supplyAdjustment: { jerrycans: 2.0, chlorine: 1.5 }
      },
      'DR': {
        severity: 'CRITICAL',
        reason: 'Water scarcity, migration to water sources',
        mitigationPriority: 'CRITICAL',
        supplyAdjustment: { jerrycans: 2.5, waterFilters: 2.0 }
      },
      'TS': {
        severity: 'CRITICAL',
        reason: 'Saltwater contamination of freshwater sources',
        mitigationPriority: 'CRITICAL',
        supplyAdjustment: { purificationTablets: 3.0, waterFilters: 2.5 }
      }
    },

    assessmentMethod: 'SPHERE Standards',
    coverageTarget: 0.95, // 95% access to safe water

    digitalTools: [
      'Water quality monitoring sensors',
      'GPS mapping of water points',
      'Mobile WASH assessment forms',
      'Real-time outbreak surveillance'
    ]
  },

  NUTRITION: {
    id: 'nutrition',
    name: 'Nutrition Program',
    icon: '🥣',
    description: 'Malnutrition screening, therapeutic feeding, supplementation',
    category: 'Food Security',

    riskFactors: {
      foodSecurity: {
        weight: 0.30,
        label: 'Food Availability',
        critical: 'Food shortages lead to acute malnutrition'
      },
      displacement: {
        weight: 0.25,
        label: 'Population Displacement',
        critical: 'Displaced populations at high malnutrition risk'
      },
      access: {
        weight: 0.20,
        label: 'Access to Distribution Sites',
        critical: 'Remote populations cannot reach nutrition centers'
      },
      diseaseOutbreak: {
        weight: 0.15,
        label: 'Disease Burden',
        critical: 'Infection increases malnutrition risk'
      }
    },

    supplies: [
      'Ready-to-Use Therapeutic Food (RUTF)',
      'Micronutrient supplements',
      'Mid-Upper Arm Circumference (MUAC) tapes',
      'Infant formula (emergency only)',
      'Vitamin A supplements',
      'Therapeutic milk (F-75, F-100)'
    ],

    disasterImpacts: {
      'DR': {
        severity: 'CRITICAL',
        reason: 'Crop failure, livestock death, severe food insecurity',
        mitigationPriority: 'CRITICAL',
        supplyAdjustment: { RUTF: 3.0, supplements: 2.5 }
      },
      'FL': {
        severity: 'HIGH',
        reason: 'Crop destruction, contaminated food supplies',
        mitigationPriority: 'HIGH',
        supplyAdjustment: { RUTF: 2.0, supplements: 1.5 }
      },
      'TC': {
        severity: 'HIGH',
        reason: 'Food storage destruction, supply chain disruption',
        mitigationPriority: 'HIGH',
        supplyAdjustment: { RUTF: 2.0 }
      },
      'EQ': {
        severity: 'MEDIUM',
        reason: 'Displacement, disrupted food distribution',
        mitigationPriority: 'MEDIUM'
      }
    },

    assessmentMethod: 'SMART Survey',
    coverageTarget: 0.85, // 85% coverage of SAM cases

    digitalTools: [
      'Digital MUAC screening',
      'Mobile nutrition surveillance',
      'Supply chain tracking',
      'Beneficiary registration systems'
    ]
  },

  MEDICAL_SUPPLY: {
    id: 'medical_supply',
    name: 'Medical Supply Distribution',
    icon: '🏥',
    description: 'Emergency medical kits, trauma supplies, essential medicines',
    category: 'Health Supply Chain',

    riskFactors: {
      facilityDamage: {
        weight: 0.25,
        label: 'Health Facility Integrity',
        critical: 'Damaged facilities cannot store/distribute supplies'
      },
      access: {
        weight: 0.30,
        label: 'Road Access & Logistics',
        critical: 'Impassable roads prevent supply delivery'
      },
      security: {
        weight: 0.20,
        label: 'Security & Looting Risk',
        critical: 'Medical supplies vulnerable to theft'
      },
      coldChain: {
        weight: 0.15,
        label: 'Temperature-Sensitive Items',
        critical: 'Some medications require refrigeration'
      }
    },

    supplies: [
      'Interagency Emergency Health Kits (IEHK)',
      'Trauma and surgical supplies',
      'Essential medicines (antibiotics, analgesics)',
      'IV fluids and rehydration salts',
      'Personal protective equipment (PPE)',
      'Medical equipment (stethoscopes, BP cuffs, etc.)'
    ],

    disasterImpacts: {
      'EQ': {
        severity: 'CRITICAL',
        reason: 'Mass trauma casualties, facility damage, overwhelmed healthcare',
        mitigationPriority: 'CRITICAL',
        supplyAdjustment: { traumaKits: 5.0, IVfluids: 3.0, painMeds: 3.0 }
      },
      'TC': {
        severity: 'CRITICAL',
        reason: 'Trauma injuries, facility destruction, isolated communities',
        mitigationPriority: 'CRITICAL',
        supplyAdjustment: { traumaKits: 4.0, IVfluids: 2.5 }
      },
      'FL': {
        severity: 'HIGH',
        reason: 'Waterborne diseases, respiratory infections',
        mitigationPriority: 'HIGH',
        supplyAdjustment: { antibiotics: 2.0, ORS: 2.5 }
      },
      'VO': {
        severity: 'HIGH',
        reason: 'Respiratory issues, burns from ash/lava',
        mitigationPriority: 'HIGH',
        supplyAdjustment: { respiratoryMeds: 2.5, burnKits: 3.0 }
      },
      'WF': {
        severity: 'HIGH',
        reason: 'Burn injuries, smoke inhalation',
        mitigationPriority: 'HIGH',
        supplyAdjustment: { burnKits: 4.0, respiratoryMeds: 2.0 }
      }
    },

    assessmentMethod: 'Rapid Health Assessment',
    coverageTarget: 0.90, // 90% facility coverage

    digitalTools: [
      'Inventory management systems',
      'Barcode/RFID tracking',
      'Last-mile delivery tracking',
      'Facility needs assessments'
    ]
  },

  SHELTER: {
    id: 'shelter',
    name: 'Emergency Shelter',
    icon: '⛺',
    description: 'Temporary shelter, NFI distribution, site planning',
    category: 'Protection',

    riskFactors: {
      displacement: {
        weight: 0.35,
        label: 'Population Displacement',
        critical: 'Destroyed homes force mass displacement'
      },
      siteSafety: {
        weight: 0.25,
        label: 'Site Safety & Hazards',
        critical: 'Aftershocks, landslides, flooding threaten shelter sites'
      },
      winterization: {
        weight: 0.15,
        label: 'Weather/Climate',
        critical: 'Cold weather, monsoon season timing critical'
      },
      landAvailability: {
        weight: 0.15,
        label: 'Available Land',
        critical: 'Safe land for camps/shelters scarce'
      }
    },

    supplies: [
      'Emergency shelter kits (tarpaulins, rope, tools)',
      'Tents (family and communal)',
      'Sleeping mats and blankets',
      'Non-food items (NFI) kits',
      'Plastic sheeting',
      'Construction materials (timber, corrugated sheets)'
    ],

    disasterImpacts: {
      'EQ': {
        severity: 'CRITICAL',
        reason: 'Widespread building destruction, unsafe structures',
        mitigationPriority: 'CRITICAL',
        supplyAdjustment: { tents: 3.0, shelterKits: 2.5, blankets: 2.0 }
      },
      'TC': {
        severity: 'CRITICAL',
        reason: 'Roof/structure damage, flooding, displacement',
        mitigationPriority: 'CRITICAL',
        supplyAdjustment: { tarpaulins: 3.0, tents: 2.5 }
      },
      'FL': {
        severity: 'HIGH',
        reason: 'Flooded homes, displacement to higher ground',
        mitigationPriority: 'HIGH',
        supplyAdjustment: { tents: 2.0, tarpaulins: 2.0 }
      },
      'VO': {
        severity: 'CRITICAL',
        reason: 'Evacuation zones, destroyed homes from lava/ash',
        mitigationPriority: 'CRITICAL',
        supplyAdjustment: { tents: 2.5, shelterKits: 2.0 }
      },
      'WF': {
        severity: 'CRITICAL',
        reason: 'Burned homes, evacuation from fire zones',
        mitigationPriority: 'CRITICAL',
        supplyAdjustment: { tents: 2.5, shelterKits: 2.5 }
      }
    },

    assessmentMethod: 'SPHERE Shelter Standards',
    coverageTarget: 0.95, // 95% shelter coverage for displaced

    digitalTools: [
      'GPS camp mapping',
      'Biometric beneficiary registration',
      'NFI distribution tracking',
      'Site monitoring dashboards'
    ]
  },

  GENERAL: {
    id: 'general',
    name: 'General Humanitarian Operation',
    icon: '🌍',
    description: 'Multi-sector response or custom operation',
    category: 'General',

    riskFactors: {
      access: {
        weight: 0.25,
        label: 'Access & Logistics',
        critical: 'Ability to reach affected populations'
      },
      security: {
        weight: 0.25,
        label: 'Security Environment',
        critical: 'Safety of staff and beneficiaries'
      },
      infrastructure: {
        weight: 0.25,
        label: 'Infrastructure Status',
        critical: 'Functioning facilities and services'
      },
      displacement: {
        weight: 0.15,
        label: 'Population Displacement',
        critical: 'Movement and concentration of populations'
      }
    },

    supplies: [
      'Context-dependent based on operation type'
    ],

    disasterImpacts: {
      'ALL': {
        severity: 'MEDIUM',
        reason: 'Generic disaster impact assessment',
        mitigationPriority: 'MEDIUM'
      }
    },

    assessmentMethod: 'Multi-Cluster Initial Rapid Assessment (MIRA)',
    coverageTarget: 0.80,

    digitalTools: [
      'Mobile data collection',
      'Coordination platforms',
      'Mapping tools'
    ]
  }
};

/**
 * Get operation type by ID
 */
export const getOperationType = (id) => {
  return Object.values(OPERATION_TYPES).find(type => type.id === id) || OPERATION_TYPES.GENERAL;
};

/**
 * Get all operation types as array
 */
export const getAllOperationTypes = () => {
  return Object.values(OPERATION_TYPES);
};

/**
 * Get operation types by category
 */
export const getOperationTypesByCategory = (category) => {
  return Object.values(OPERATION_TYPES).filter(type => type.category === category);
};

/**
 * Calculate adjusted viability score based on operation type
 */
export const calculateOperationSpecificScore = (baseScore, operationType, disaster, distance) => {
  const disasterType = disaster.eventType?.toUpperCase();
  const opConfig = getOperationType(operationType);

  // Get disaster-specific impact for this operation type
  const disasterImpact = opConfig.disasterImpacts[disasterType] || opConfig.disasterImpacts['ALL'];

  if (!disasterImpact) return baseScore;

  // Apply severity-based scoring
  let adjustment = 0;
  switch (disasterImpact.severity) {
    case 'CRITICAL':
      adjustment = distance < 10 ? -45 : distance < 50 ? -30 : -15;
      break;
    case 'HIGH':
      adjustment = distance < 10 ? -35 : distance < 50 ? -20 : -10;
      break;
    case 'MEDIUM':
      adjustment = distance < 10 ? -25 : distance < 50 ? -15 : -5;
      break;
    default:
      adjustment = distance < 10 ? -20 : distance < 50 ? -10 : -5;
  }

  return Math.max(0, baseScore + adjustment);
};

export default OPERATION_TYPES;
