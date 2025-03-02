import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

const EvacuationCalculator = () => {
  // Basis gebouwparameters
  const [numberOfStairs, setNumberOfStairs] = useState(5);
  const [numberOfFloors, setNumberOfFloors] = useState(5);
  const [lowestFloor, setLowestFloor] = useState(-1);
  const [hasVestibules, setHasVestibules] = useState(true);
  const [evacuationTimeMinutes, setEvacuationTimeMinutes] = useState(20);
  const [peoplePerFloor, setPeoplePerFloor] = useState({});
  const [timeStepSize, setTimeStepSize] = useState(30); // standaard 30 seconden per tijdstap
  
  // Uitgebreide parameters
  const [stairsData, setStairsData] = useState([]);
  const [floorsHeight, setFloorsHeight] = useState(3); // Standaard verdiepingshoogte in meters
  const [floorExitFlowRate, setFloorExitFlowRate] = useState(45); // Personen per minuut per meter breedte
  const [stairFlowRate, setStairFlowRate] = useState(33); // Personen per minuut per meter breedte voor trappen
  const [vestibuleFlowReduction, setVestibuleFlowReduction] = useState(0.85); // Vermindering door voorportalen (factor)
  
  // Results
  const [calculationResults, setCalculationResults] = useState(null);
  const [totalEvacuationTime, setTotalEvacuationTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  
  // Floors state to manage dynamic inputs for people per floor
  const [floors, setFloors] = useState([]);
  
  // Initialize stair data when number of stairs changes
  useEffect(() => {
    const newStairsData = [];
    for (let i = 0; i < numberOfStairs; i++) {
      newStairsData.push({
        id: i + 1,
        name: String.fromCharCode(65 + i), // A, B, C, D, E...
        width: 1.2, // Standaard trapbreedte in meters
        freeWidth: 1.0, // Vrije breedte in meters
        hasLandings: true,
        landingsPerFloor: 2, // Standaard 2 bordessen per verdieping
        landingSize: 1.5, // Standaard bordesgrootte in meters
        flowCapacity: 33, // Standaard doorstroomcapaciteit pers/min
        resistance: 1.0, // Weerstandsfactor
        exitDoorWidth: 0.85, // Breedte van de uitgang in meters
        hasVestibule: hasVestibules, // Voorportaal aanwezig
        vestibuleDepth: 1.5, // Diepte van voorportaal in meters
        vestibuleDoorWidth: 0.85, // Breedte van deur in voorportaal
        specificTravelDistances: {}, // Specifieke loopafstanden per verdieping
        travelDistanceFloor: 15, // Standaard loopafstand per verdieping in meters
        travelSpeed: 1.6, // Loopsnelheid in meters per seconde
        floorEvacuationDelay: 60, // Vertraging in seconden voordat evacuatie op een verdieping begint
        // Extra parameters uit de Excel-sheet
        capacityReduction: 1.0, // Vermindering doorstroomcapaciteit (factor)
        minWidth: 0.85, // Minimale breedte
        receiveCapacity: 120, // Opvangcapaciteit personen
      });
    }
    setStairsData(newStairsData);
  }, [numberOfStairs, hasVestibules]);
  
  // Update floors array when parameters change
  useEffect(() => {
    const floorArray = [];
    for (let i = numberOfFloors - 1; i >= lowestFloor; i--) {
      floorArray.push(i);
    }
    setFloors(floorArray);
    
    // Initialize peoplePerFloor object
    const peopleObj = {};
    floorArray.forEach(floor => {
      peopleObj[floor] = peoplePerFloor[floor] || 100; // Default 100 people per floor
    });
    setPeoplePerFloor(peopleObj);
    
    // Update specificTravelDistances voor alle trappen
    setStairsData(prevStairsData => {
      return prevStairsData.map(stair => {
        const travelDistances = {...stair.specificTravelDistances};
        floorArray.forEach(floor => {
          if (!travelDistances[floor]) {
            travelDistances[floor] = stair.travelDistanceFloor;
          }
        });
        return {...stair, specificTravelDistances: travelDistances};
      });
    });
  }, [numberOfFloors, lowestFloor]);
  
  // Handle change in people count for a specific floor
  const handlePeopleChange = (floor, value) => {
    setPeoplePerFloor({
      ...peoplePerFloor,
      [floor]: parseInt(value) || 0
    });
  };
  
  // Handle change in stair data
  const handleStairDataChange = (stairId, property, value) => {
    const updatedStairsData = [...stairsData];
    const stairIndex = updatedStairsData.findIndex(stair => stair.id === stairId);
    
    if (stairIndex !== -1) {
      // Voor numerieke waarden, zorg ervoor dat ze worden geconverteerd naar nummers
      if ([
        'width', 'freeWidth', 'landingSize', 'flowCapacity', 'resistance', 
        'exitDoorWidth', 'vestibuleDepth', 'vestibuleDoorWidth', 'landingsPerFloor',
        'travelDistanceFloor', 'travelSpeed', 'floorEvacuationDelay',
        'capacityReduction', 'minWidth', 'receiveCapacity'
      ].includes(property)) {
        value = parseFloat(value) || 0;
      }
      
      // Voor boolean waarden
      if (['hasLandings', 'hasVestibule'].includes(property)) {
        value = value === 'true';
      }
      
      // Voor specifieke vloer loopafstanden
      if (property.startsWith('travelDistance_')) {
        const floorNumber = parseInt(property.split('_')[1]);
        const specificTravelDistances = {
          ...updatedStairsData[stairIndex].specificTravelDistances,
          [floorNumber]: parseFloat(value) || 0
        };
        updatedStairsData[stairIndex] = {
          ...updatedStairsData[stairIndex],
          specificTravelDistances
        };
      } else {
        updatedStairsData[stairIndex] = {
          ...updatedStairsData[stairIndex],
          [property]: value
        };
      }
      
      setStairsData(updatedStairsData);
    }
  };
  
  // Bereken de doorstroomcapaciteit van een trap per minuut
  const calculateStairFlowCapacity = (stair) => {
    // Basis doorstroomcapaciteit op basis van breedte
    const baseCapacity = stair.width * stairFlowRate;
    
    // Correctie voor vrije breedte
    const freeWidthFactor = Math.min(1, stair.freeWidth / stair.width);
    
    // Correctie voor bordessen
    const landingFactor = stair.hasLandings ? 
      Math.max(0.6, Math.min(1, stair.landingSize / 2)) : 1;
    
    // Correctie voor voorportalen
    const vestibuleFactor = stair.hasVestibule ? vestibuleFlowReduction : 1;
    
    // Extra correctiefactor uit het model
    const capacityReductionFactor = stair.capacityReduction;
    
    // Totale capaciteit na correcties
    return baseCapacity * freeWidthFactor * landingFactor * vestibuleFactor * capacityReductionFactor;
  };
  
  // Bereken de uitstroomcapaciteit van een verdieping naar een trap
  const calculateFloorExitCapacity = (stair, floor) => {
    // De uitstroomcapaciteit is bepaald door de doorgang naar de trap
    let capacity;
    
    if (stair.hasVestibule) {
      // Doorgang beperkt door voorportaaldeur
      capacity = stair.vestibuleDoorWidth * floorExitFlowRate * vestibuleFlowReduction;
    } else {
      // Directe doorgang naar trap
      capacity = stair.width * floorExitFlowRate;
    }
    
    // Specifieke beperkingen per verdieping kunnen hier worden toegevoegd
    
    return capacity;
  };
  
  // Bereken de looptijd van een punt op een verdieping naar een trap
  const calculateTravelTime = (stair, floor) => {
    // Gebruik de specifieke loopafstand voor deze verdieping en trap indien beschikbaar
    const travelDistance = stair.specificTravelDistances[floor] || stair.travelDistanceFloor;
    
    // Looptijd = afstand / snelheid (in seconden)
    return travelDistance / stair.travelSpeed;
  };
  
  // Bereken de tijd die het kost om een trap af te dalen
  const calculateStairDescentTime = (stair, fromFloor, toFloor) => {
    const floorsToDescend = fromFloor - toFloor;
    if (floorsToDescend <= 0) return 0;
    
    // Gemiddelde tijd om één verdieping af te dalen (seconden)
    const timePerFloor = 30; // Dit is een benadering, moet worden aangepast aan werkelijke waardes
    
    // Extra tijd voor bordessen
    const landingDelay = stair.hasLandings ? stair.landingsPerFloor * 2 : 0; // 2 seconden per bordes
    
    // Totale tijd voor afdaling
    return floorsToDescend * (timePerFloor + landingDelay);
  };
  
  // Implementeer een meer gedetailleerde, tijdstap-gebaseerde simulatie van evacuatie
  const calculateEvacuation = () => {
    // Bereken het totaal aantal personen in het gebouw
    const totalPeople = Object.values(peoplePerFloor).reduce((sum, count) => sum + count, 0);
    
    // Bereken de totale hoogte van het gebouw
    const totalHeight = (numberOfFloors - 1 + Math.abs(Math.min(0, lowestFloor))) * floorsHeight;
    
    // Maak een kopie van stairsData voor de berekening
    const stairs = [...stairsData];
    
    // Definieer de tijdstap in seconden
    const timeStep = timeStepSize; // Bijvoorbeeld 30 seconden per stap
    
    // Bereken de maximum tijd in seconden (omzetten van minuten)
    const maxTimeSeconds = evacuationTimeMinutes * 60;
    
    // Bepaal hoeveel tijdstappen we nodig hebben (met een buffer van 2x)
    const totalTimeSteps = Math.ceil((maxTimeSeconds * 2) / timeStep);
    
    // Initialiseer de simulatiegegevens
    const simulationData = {
      timeSteps: [],
      floorData: {},
      stairData: {},
      evacuationProgress: [],
      totalEvacuated: 0
    };
    
    // Initialiseer de status voor elke verdieping en trap
    floors.forEach(floor => {
      simulationData.floorData[floor] = {
        originalPeople: peoplePerFloor[floor] || 0,
        remainingPeople: peoplePerFloor[floor] || 0,
        evacuationStartTime: floor * stairsData[0].floorEvacuationDelay, // Vereenvoudigde benadering
        evacuationDelay: stairsData[0].floorEvacuationDelay
      };
    });
    
    stairs.forEach(stair => {
      simulationData.stairData[stair.id] = {
        flowCapacity: calculateStairFlowCapacity(stair),
        exitCapacity: stair.exitDoorWidth * floorExitFlowRate,
        peopleOnStair: 0,
        totalEvacuated: 0,
        peoplePerFloor: {}
      };
      
      // Initialiseer het aantal personen per verdieping voor elke trap
      floors.forEach(floor => {
        simulationData.stairData[stair.id].peoplePerFloor[floor] = 0;
      });
    });
    
    // Run de simulatie voor elke tijdstap
    for (let step = 0; step <= totalTimeSteps; step++) {
      const currentTime = step * timeStep; // Huidige tijd in seconden
      
      // Datastructuur voor deze tijdstap
      const timeStepData = {
        step,
        time: currentTime,
        timeMinutes: currentTime / 60,
        stairData: {},
        floorData: {},
        totalEvacuated: 0,
        remainingInBuilding: totalPeople
      };
      
      // Update elke trap voor deze tijdstap
      stairs.forEach(stair => {
        const stairId = stair.id;
        const stairState = simulationData.stairData[stairId];
        
        // Hoeveel mensen kunnen de trap verlaten in deze tijdstap
        const exitCapacityThisStep = (stairState.exitCapacity / 60) * timeStep;
        let exitingThisStep = Math.min(stairState.peopleOnStair, exitCapacityThisStep);
        
        // Update het aantal geëvacueerde personen
        stairState.totalEvacuated += exitingThisStep;
        stairState.peopleOnStair -= exitingThisStep;
        
        // Update elke verdieping voor deze trap
        floors.forEach(floor => {
          // Is de evacuatie al begonnen op deze verdieping?
          const floorState = simulationData.floorData[floor];
          
          if (currentTime >= floorState.evacuationStartTime && floorState.remainingPeople > 0) {
            // Bereken hoeveel mensen de verdieping kunnen verlaten naar deze trap
            const exitCapacity = calculateFloorExitCapacity(stair, floor);
            const exitCapacityThisStep = (exitCapacity / 60) * timeStep;
            
            // Hoeveel mensen gaan proberen de verdieping te verlaten?
            const attemptingToExit = Math.min(floorState.remainingPeople, exitCapacityThisStep);
            
            // Hoe vol is de trap al? (vereenvoudigde controle op opvangcapaciteit)
            const stairFillFactor = stairState.peopleOnStair / stair.receiveCapacity;
            const flowReduction = Math.max(0, 1 - stairFillFactor);
            
            // Uiteindelijk aantal dat daadwerkelijk de trap op gaat
            const actuallyExiting = attemptingToExit * flowReduction;
            
            // Update de status
            floorState.remainingPeople -= actuallyExiting;
            stairState.peopleOnStair += actuallyExiting;
            stairState.peoplePerFloor[floor] += actuallyExiting;
          }
        });
        
        // Update de gegenereerde data voor deze tijdstap
        timeStepData.stairData[stairId] = {
          peopleOnStair: stairState.peopleOnStair,
          totalEvacuated: stairState.totalEvacuated,
          peoplePerFloor: {...stairState.peoplePerFloor}
        };
        
        timeStepData.totalEvacuated += stairState.totalEvacuated;
      });
      
      // Update de vloerdata
      floors.forEach(floor => {
        timeStepData.floorData[floor] = {
          remainingPeople: simulationData.floorData[floor].remainingPeople
        };
      });
      
      // Bereken hoeveel mensen er nog in het gebouw zijn
      timeStepData.remainingInBuilding = totalPeople - timeStepData.totalEvacuated;
      
      // Voeg deze tijdstap toe aan de simulatie
      simulationData.timeSteps.push(timeStepData);
      
      // Als iedereen is geëvacueerd, stoppen we de simulatie
      if (timeStepData.remainingInBuilding <= 0) {
        break;
      }
    }
    
    // Bereken de totale evacuatietijd (de tijd waarop de laatste persoon het gebouw verlaat)
    const evacuationTimeStep = simulationData.timeSteps.find(step => 
      step.remainingInBuilding <= 0 || step.totalEvacuated >= totalPeople * 0.99 // 99% als benadering
    );
    
    const calculatedEvacuationTime = evacuationTimeStep ? 
      evacuationTimeStep.timeMinutes : 
      simulationData.timeSteps[simulationData.timeSteps.length - 1].timeMinutes;
    
    setTotalEvacuationTime(calculatedEvacuationTime);
    
    // Bereken totale doorstroomcapaciteit van alle trappen
    const totalStairCapacity = stairs.reduce((sum, stair) => {
      return sum + calculateStairFlowCapacity(stair);
    }, 0);
    
    // Bereken totale uitgangsdeuren capaciteit
    const totalExitDoorCapacity = stairs.reduce((sum, stair) => {
      return sum + (stair.exitDoorWidth * floorExitFlowRate);
    }, 0);
    
    // Prepareer data voor de grafieken
    const timeSeriesData = simulationData.timeSteps.filter((_, index) => 
      // Filter alleen een subset van punten voor de grafiek als er te veel zijn
      index % Math.max(1, Math.floor(simulationData.timeSteps.length / 40)) === 0
    ).map(step => {
      const dataPoint = { 
        timeStep: step.step,
        time: (step.timeMinutes).toFixed(1)
      };
      
      // Personen per trap
      stairs.forEach(stair => {
        dataPoint[`stair${stair.id}`] = Math.round(step.stairData[stair.id].totalEvacuated);
      });
      
      // Totale evacuatie
      dataPoint.total = Math.round(step.totalEvacuated);
      
      return dataPoint;
    });
    
    // Genereer data per verdieping voor visualisatie
    const floorData = floors.map(floor => ({
      floor,
      people: peoplePerFloor[floor] || 0,
      evacuationStartTime: (simulationData.floorData[floor].evacuationStartTime / 60).toFixed(1),
      remainingAtEnd: Math.round(
        simulationData.timeSteps[simulationData.timeSteps.length - 1].floorData[floor].remainingPeople
      )
    }));
    
    // Bereken kritieke looppaden en -tijden
    const criticalPaths = [];
    floors.forEach(floor => {
      let slowestPathTime = 0;
      let slowestStair = null;
      
      stairs.forEach(stair => {
        // Tijd om de trap te bereiken
        const travelTime = calculateTravelTime(stair, floor);
        
        // Tijd om de trap af te dalen naar de uitgang
        const descentTime = calculateStairDescentTime(stair, floor, lowestFloor);
        
        // Totale tijd
        const totalPathTime = travelTime + descentTime;
        
        if (totalPathTime > slowestPathTime) {
          slowestPathTime = totalPathTime;
          slowestStair = stair;
        }
      });
      
      if (slowestStair) {
        criticalPaths.push({
          floor,
          stair: slowestStair.name,
          travelTime: calculateTravelTime(slowestStair, floor),
          descentTime: calculateStairDescentTime(slowestStair, floor, lowestFloor),
          totalTime: slowestPathTime
        });
      }
    });
    
    // Stel resultaten in voor weergave
    setCalculationResults({
      timeSeriesData,
      floorData,
      totalPeople,
      stairCapacity: Math.round(totalStairCapacity),
      totalHeight,
      exitDoorCapacity: Math.round(totalExitDoorCapacity),
      criticalPaths,
      detailedTimeSteps: simulationData.timeSteps
    });
    
    setShowResults(true);
  };
  
  // Reset de berekening en ga terug naar het invoerscherm
  const resetCalculation = () => {
    setShowResults(false);
    setCalculationResults(null);
  };
  
  return (
    <div className="p-6 max-w-6xl mx-auto bg-white">
      <h1 className="text-2xl font-bold mb-6 text-blue-800">BBL Gebouwevacuatie Rekentool</h1>
      
      {!showResults ? (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Gebouwparameters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Aantal trappen</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={numberOfStairs}
                  onChange={(e) => setNumberOfStairs(parseInt(e.target.value))}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Aantal bouwlagen</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={numberOfFloors}
                  onChange={(e) => setNumberOfFloors(parseInt(e.target.value))}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Laagste verdieping</label>
                <input
                  type="number"
                  min="-10"
                  max="0"
                  value={lowestFloor}
                  onChange={(e) => setLowestFloor(parseInt(e.target.value))}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Voorportalen aanwezig</label>
                <select
                  value={hasVestibules ? "true" : "false"}
                  onChange={(e) => setHasVestibules(e.target.value === "true")}
                  className="w-full p-2 border rounded"
                >
                  <option value="true">Ja</option>
                  <option value="false">Nee</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Verdiepingshoogte (m)</label>
                <input
                  type="number"
                  min="2"
                  max="6"
                  step="0.1"
                  value={floorsHeight}
                  onChange={(e) => setFloorsHeight(parseFloat(e.target.value))}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Maximale ontruimingstijd (min)</label>
                <select
                  value={evacuationTimeMinutes}
                  onChange={(e) => setEvacuationTimeMinutes(parseInt(e.target.value))}
                  className="w-full p-2 border rounded"
                >
                  <option value="15">15 minuten</option>
                  <option value="20">20 minuten</option>
                  <option value="30">30 minuten</option>
                  <option value="38">38 minuten</option>
                  <option value="76">76 minuten</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4">
              <button 
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="text-blue-700 underline"
              >
                {showAdvancedSettings ? "Verberg geavanceerde instellingen" : "Toon geavanceerde instellingen"}
              </button>
              
              {showAdvancedSettings && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-blue-100 rounded">
                  <div>
                    <label className="block text-sm font-medium mb-1">Doorstroomcapaciteit verdieping (pers/min/m)</label>
                    <input
                      type="number"
                      min="20"
                      max="100"
                      step="1"
                      value={floorExitFlowRate}
                      onChange={(e) => setFloorExitFlowRate(parseFloat(e.target.value))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Doorstroomcapaciteit trap (pers/min/m)</label>
                    <input
                      type="number"
                      min="20"
                      max="100"
                      step="1"
                      value={stairFlowRate}
                      onChange={(e) => setStairFlowRate(parseFloat(e.target.value))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Reductiefactor voorportaal</label>
                    <input
                      type="number"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={vestibuleFlowReduction}
                      onChange={(e) => setVestibuleFlowReduction(parseFloat(e.target.value))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Tijdstap simulatie (sec)</label>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      step="5"
                      value={timeStepSize}
                      onChange={(e) => setTimeStepSize(parseInt(e.target.value))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Trapspecificaties</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="p-2 text-left">Trap</th>
                    <th className="p-2 text-left">Breedte (m)</th>
                    <th className="p-2 text-left">Vrije breedte (m)</th>
                    <th className="p-2 text-left">Bordessen</th>
                    <th className="p-2 text-left">Bordessen per verdieping</th>
                    <th className="p-2 text-left">Bordesgrootte (m)</th>
                    <th className="p-2 text-left">Doorstroomcap. (pers/min/m)</th>
                    <th className="p-2 text-left">Uitgang breedte (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {stairsData.map(stair => (
                    <tr key={stair.id} className="border-b">
                      <td className="p-2">{stair.name}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0.8"
                          max="3"
                          step="0.1"
                          value={stair.width}
                          onChange={(e) => handleStairDataChange(stair.id, 'width', e.target.value)}
                          className="w-20 p-1 border rounded"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0.6"
                          max="3"
                          step="0.1"
                          value={stair.freeWidth}
                          onChange={(e) => handleStairDataChange(stair.id, 'freeWidth', e.target.value)}
                          className="w-20 p-1 border rounded"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={stair.hasLandings.toString()}
                          onChange={(e) => handleStairDataChange(stair.id, 'hasLandings', e.target.value)}
                          className="p-1 border rounded"
                        >
                          <option value="true">Ja</option>
                          <option value="false">Nee</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          max="4"
                          step="1"
                          disabled={!stair.hasLandings}
                          value={stair.landingsPerFloor}
                          onChange={(e) => handleStairDataChange(stair.id, 'landingsPerFloor', e.target.value)}
                          className="w-20 p-1 border rounded"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0.5"
                          max="3"
                          step="0.1"
                          disabled={!stair.hasLandings}
                          value={stair.landingSize}
                          onChange={(e) => handleStairDataChange(stair.id, 'landingSize', e.target.value)}
                          className="w-20 p-1 border rounded"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="20"
                          max="100"
                          step="1"
                          value={stair.flowCapacity}
                          onChange={(e) => handleStairDataChange(stair.id, 'flowCapacity', e.target.value)}
                          className="w-20 p-1 border rounded"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0.6"
                          max="2.5"
                          step="0.05"
                          value={stair.exitDoorWidth}
                          onChange={(e) => handleStairDataChange(stair.id, 'exitDoorWidth', e.target.value)}
                          className="w-20 p-1 border rounded"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {showAdvancedSettings && (
              <div className="mt-4">
                <h3 className="font-medium text-sm mb-2">Extra Trapparameters</h3>
                {stairsData.map(stair => (
                  <div key={`adv-${stair.id}`} className="mb-4 p-3 bg-blue-100 rounded">
                    <h4 className="font-medium mb-2">Trap {stair.name} - Geavanceerde instellingen</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs mb-1">Voorportaal aanwezig</label>
                        <select
                          value={stair.hasVestibule.toString()}
                          onChange={(e) => handleStairDataChange(stair.id, 'hasVestibule', e.target.value)}
                          className="w-full p-1 border rounded text-sm"
                        >
                          <option value="true">Ja</option>
                          <option value="false">Nee</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Voorportaaldiepte (m)</label>
                        <input
                          type="number"
                          min="0.5"
                          max="3"
                          step="0.1"
                          disabled={!stair.hasVestibule}
                          value={stair.vestibuleDepth}
                          onChange={(e) => handleStairDataChange(stair.id, 'vestibuleDepth', e.target.value)}
                          className="w-full p-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Voorportaaldeur breedte (m)</label>
                        <input
                          type="number"
                          min="0.6"
                          max="2.5"
                          step="0.05"
                          disabled={!stair.hasVestibule}
                          value={stair.vestibuleDoorWidth}
                          onChange={(e) => handleStairDataChange(stair.id, 'vestibuleDoorWidth', e.target.value)}
                          className="w-full p-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Weerstandsfactor</label>
                        <input
                          type="number"
                          min="0.5"
                          max="1.5"
                          step="0.05"
                          value={stair.resistance}
                          onChange={(e) => handleStairDataChange(stair.id, 'resistance', e.target.value)}
                          className="w-full p-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Loopafstand naar trap (m)</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={stair.travelDistanceFloor}
                          onChange={(e) => handleStairDataChange(stair.id, 'travelDistanceFloor', e.target.value)}
                          className="w-full p-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Loopsnelheid (m/s)</label>
                        <input
                          type="number"
                          min="0.5"
                          max="2.5"
                          step="0.1"
                          value={stair.travelSpeed}
                          onChange={(e) => handleStairDataChange(stair.id, 'travelSpeed', e.target.value)}
                          className="w-full p-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Vertraging voor verdieping (s)</label>
                        <input
                          type="number"
                          min="0"
                          max="300"
                          step="15"
                          value={stair.floorEvacuationDelay}
                          onChange={(e) => handleStairDataChange(stair.id, 'floorEvacuationDelay', e.target.value)}
                          className="w-full p-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Capaciteitsreductie</label>
                        <input
                          type="number"
                          min="0.1"
                          max="1"
                          step="0.05"
                          value={stair.capacityReduction}
                          onChange={(e) => handleStairDataChange(stair.id, 'capacityReduction', e.target.value)}
                          className="w-full p-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">Opvangcapaciteit (pers)</label>
                        <input
                          type="number"
                          min="10"
                          max="500"
                          step="10"
                          value={stair.receiveCapacity}
                          onChange={(e) => handleStairDataChange(stair.id, 'receiveCapacity', e.target.value)}
                          className="w-full p-1 border rounded text-sm"
                        />
                      </div>
                    </div>
                    
                    {floors.length > 0 && (
                      <div className="mt-3">
                        <h5 className="text-xs font-medium mb-1">Specifieke loopafstanden per verdieping (m)</h5>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {floors.map(floor => (
                            <div key={`dist-${stair.id}-${floor}`}>
                              <label className="block text-xs mb-1">Verd. {floor}</label>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                step="1"
                                value={stair.specificTravelDistances[floor] || stair.travelDistanceFloor}
                                onChange={(e) => handleStairDataChange(stair.id, `travelDistance_${floor}`, e.target.value)}
                                className="w-full p-1 border rounded text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Personen per verdieping</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {floors.map(floor => (
                <div key={floor}>
                  <label className="block text-sm font-medium mb-1">
                    Verdieping {floor}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={peoplePerFloor[floor] || 0}
                    onChange={(e) => handlePeopleChange(floor, e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-center">
            <button 
              onClick={calculateEvacuation}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700"
            >
              Berekenen
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-green-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Berekeningsresultaten</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-white rounded shadow">
                <p className="font-medium">Totaal aantal personen: {calculationResults.totalPeople}</p>
              </div>
              <div className="p-3 bg-white rounded shadow">
                <p className="font-medium">Totaal aantal trappen: {numberOfStairs}</p>
              </div>
              <div className="p-3 bg-white rounded shadow">
                <p className="font-medium">Gebouwhoogte: {calculationResults.totalHeight.toFixed(1)} m</p>
              </div>
              <div className="p-3 bg-white rounded shadow">
                <p className="font-medium">Trapdoorstroomcapaciteit: {calculationResults.stairCapacity} pers/min</p>
              </div>
              <div className="p-3 bg-white rounded shadow">
                <p className="font-medium">Uitgangscapaciteit: {calculationResults.exitDoorCapacity} pers/min</p>
              </div>
              <div className="p-3 bg-white rounded shadow">
                <p className="font-medium">Ontruimingstijd: {totalEvacuationTime.toFixed(2)} minuten</p>
                {totalEvacuationTime > evacuationTimeMinutes && (
                  <p className="text-red-600 text-sm">Overschrijdt max. tijd van {evacuationTimeMinutes} min.</p>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Ontruimingsvoortgang</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={calculationResults.timeSeriesData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    label={{ value: 'Tijd (minuten)', position: 'insideBottomRight', offset: -5 }} 
                  />
                  <YAxis 
                    label={{ value: 'Aantal geëvacueerde personen', angle: -90, position: 'insideLeft' }} 
                  />
                  <Tooltip />
                  <Legend />
                  {stairsData.map(stair => (
                    <Line
                      key={`stair${stair.id}`}
                      type="monotone"
                      dataKey={`stair${stair.id}`}
                      name={`Trap ${stair.name}`}
                      stroke={`hsl(${((stair.id-1) * 120) % 360}, 70%, 50%)`}
                      strokeWidth={2}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Totale evacuatie"
                    stroke="#000"
                    strokeWidth={3}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Kritieke evacuatiepaden</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="p-2 text-left">Verdieping</th>
                    <th className="p-2 text-left">Kritieke trap</th>
                    <th className="p-2 text-right">Looptijd (sec)</th>
                    <th className="p-2 text-right">Afdaaltijd (sec)</th>
                    <th className="p-2 text-right">Totale tijd (sec)</th>
                  </tr>
                </thead>
                <tbody>
                  {calculationResults.criticalPaths.map((path, index) => (
                    <tr key={`path-${index}`} className="border-b">
                      <td className="p-2">{path.floor}</td>
                      <td className="p-2">{path.stair}</td>
                      <td className="p-2 text-right">{path.travelTime.toFixed(1)}</td>
                      <td className="p-2 text-right">{path.descentTime.toFixed(1)}</td>
                      <td className="p-2 text-right font-medium">{path.totalTime.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Personen per verdieping</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={calculationResults.floorData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="floor" 
                      type="category" 
                      label={{ value: 'Verdieping', angle: -90, position: 'insideLeft' }} 
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="people" name="Personen per verdieping" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="overflow-y-auto h-72">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-100 sticky top-0">
                      <th className="p-2 text-left">Verdieping</th>
                      <th className="p-2 text-right">Aantal personen</th>
                      <th className="p-2 text-right">Start evacuatie (min)</th>
                      <th className="p-2 text-right">Resterend einde (pers)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculationResults.floorData.map((floor, index) => (
                      <tr key={`floor-${index}`} className="border-b">
                        <td className="p-2">{floor.floor}</td>
                        <td className="p-2 text-right">{floor.people}</td>
                        <td className="p-2 text-right">{floor.evacuationStartTime}</td>
                        <td className="p-2 text-right">{floor.remainingAtEnd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center space-x-4">
            <button 
              onClick={resetCalculation}
              className="px-6 py-2 bg-gray-600 text-white font-medium rounded hover:bg-gray-700"
            >
              Terug naar invoer
            </button>
            <button 
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700"
              onClick={() => window.print()}
            >
              Resultaten exporteren
            </button>
          </div>
        </div>
      )}
      
      <div className="mt-8 pt-4 border-t text-sm text-gray-600">
        <p>Deze rekentool is gebaseerd op de eisen van het Besluit bouwwerken en leefomgeving (BBL) voor gebouwontruiming.</p>
        <p>Referentie: Artikelen <a href="https://wetten.overheid.nl/jci1.3:c:BWBR0041297&hoofdstuk=4&afdeling=4.2&paragraaf=4.2.11&artikel=4.80&z=2025-01-01&g=2025-01-01" target="_blank" className="text-blue-600 hover:underline">4.80</a> en <a href="https://wetten.overheid.nl/jci1.3:c:BWBR0041297&hoofdstuk=4&afdeling=4.2&paragraaf=4.2.11&artikel=4.81&z=2025-01-01&g=2025-01-01" target="_blank" className="text-blue-600 hover:underline">4.81</a> van het BBL.</p>
      </div>
    </div>
  );
};

export default EvacuationCalculator;