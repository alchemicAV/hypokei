import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ResponsiveContainer } from 'recharts';
import './HarmonicExplorer.css';

// Constants for just intonation ratios
const JUST_INTONATION_RATIOS = {
	"P1": 1/1,    // Perfect unison
	"m2": 16/15,  // Minor second
	"M2": 9/8,    // Major second
	"m3": 6/5,    // Minor third
	"M3": 5/4,    // Major third
	"P4": 4/3,    // Perfect fourth
	"A4": 45/32,  // Augmented fourth
	"P5": 3/2,    // Perfect fifth
	"m6": 8/5,    // Minor sixth
	"M6": 5/3,    // Major sixth
	"m7": 9/5,    // Minor seventh 
	"M7": 15/8,   // Major seventh
	"P8": 2/1     // Perfect octave
};

// 12-tone equal temperament ratios (2^(n/12) where n is semitone number)
const EQUAL_TEMPERAMENT_RATIOS = Array.from({ length: 12 }, (_, i) => Math.pow(2, i / 12));

// Utility to find GCD for ratio simplification
const gcd = (a, b) => {
	return b === 0 ? a : gcd(b, a % b);
};

// Core model functions converted to JavaScript with new structure
const generateHarmonicSeries = (f, nHarmonics = 12) => {
	return Array.from({ length: nHarmonics }, (_, i) => f * (i + 1));
};

const generateBaseFrequencies = (f, nHarmonics = 12, mode = "harmonic", customRatios = null) => {
	if (mode === "harmonic") {
		return generateHarmonicSeries(f, nHarmonics);
	} else if (mode === "just") {
		return Object.values(JUST_INTONATION_RATIOS)
			.sort((a, b) => a - b)
			.slice(0, nHarmonics)
			.map(ratio => f * ratio);
	} else if (mode === "equal") {
		return EQUAL_TEMPERAMENT_RATIOS
			.slice(0, nHarmonics)
			.map(ratio => f * ratio);
	} else if (mode === "custom" && customRatios) {
		return customRatios
			.slice(0, nHarmonics)
			.map(ratio => f * ratio);
	} else {
		throw new Error("Mode must be 'harmonic', 'just', 'equal', or 'custom'");
	}
};

// New structured frequency generation
const generateHarmonicStructure = (baseFreq, maxLevel, nHarmonics, mode, customRatios = null) => {
	const structure = {
		base: baseFreq,
		levels: []
	};
	
	// Generate H^0
	const H0 = generateBaseFrequencies(baseFreq, nHarmonics, mode, customRatios);
	structure.levels[0] = H0;
	
	// Generate higher levels recursively
	for (let level = 1; level <= maxLevel; level++) {
		const currentLevel = [];
		const prevLevel = structure.levels[level - 1];
		
		if (level === 1) {
			// H^1: each frequency in H^0 generates a harmonic series
			prevLevel.forEach(freq => {
				if (typeof freq === 'number' && !isNaN(freq)) {
					currentLevel.push(generateBaseFrequencies(freq, nHarmonics, mode, customRatios));
				}
			});
			structure.levels[level] = currentLevel;
		} else {
			// H^2+: recursively apply to nested structure
			const processNestedLevel = (data) => {
				if (Array.isArray(data)) {
					if (typeof data[0] === 'number') {
						// This is an array of frequencies, generate harmonics for each
						return data.map(freq => {
							if (typeof freq === 'number' && !isNaN(freq)) {
								return generateBaseFrequencies(freq, nHarmonics, mode, customRatios);
							}
							return [];
						});
					} else {
						// This is an array of arrays, process recursively
						return data.map(subArray => processNestedLevel(subArray));
					}
				}
				return [];
			};
			
			const result = processNestedLevel(prevLevel);
			structure.levels[level] = result;
		}
	}
	
	return structure;
};

// Helper function to get all frequencies from structure with path information
const extractAllFrequenciesWithPaths = (structure) => {
	const result = [];
	
	if (!structure || !structure.base || !structure.levels) {
		return result;
	}
	
	// Add base frequency
	if (typeof structure.base === 'number' && !isNaN(structure.base)) {
		result.push({
			frequency: structure.base,
			level: -1,
			path: [],
			pathString: 'Base'
		});
	}
	
	// Process each level
	structure.levels.forEach((level, levelIndex) => {
		if (!level) return;
		
		const processLevel = (data, currentPath, depth) => {
			if (!Array.isArray(data)) return;
			
			if (depth === 0) {
				// Base case: data is an array of frequencies
				data.forEach((freq, index) => {
					if (typeof freq === 'number' && !isNaN(freq)) {
						const fullPath = [...currentPath, index];
						const pathString = `H^${levelIndex}[${fullPath.join(',')}]`;
						result.push({
							frequency: freq,
							level: levelIndex,
							path: fullPath,
							pathString: pathString
						});
					}
				});
			} else {
				// Recursive case: data is array of arrays
				data.forEach((subArray, index) => {
					if (Array.isArray(subArray)) {
						processLevel(subArray, [...currentPath, index], depth - 1);
					}
				});
			}
		};
		
		if (levelIndex === 0) {
			// H^0 is a simple array
			if (Array.isArray(level)) {
				level.forEach((freq, index) => {
					if (typeof freq === 'number' && !isNaN(freq)) {
						result.push({
							frequency: freq,
							level: levelIndex,
							path: [index],
							pathString: `H^${levelIndex}[${index}]`
						});
					}
				});
			}
		} else {
			// H^1+ are nested arrays - depth should match the level index for proper nesting
			processLevel(level, [], levelIndex);
		}
	});
	
	return result;
};

// Helper function to flatten all frequencies (for backward compatibility)
const flattenFrequencies = (structure) => {
	const allFreqs = extractAllFrequenciesWithPaths(structure);
	return allFreqs.map(item => item.frequency);
};

// Simplified utility functions for creating hierarchical data
const createFrequencyTree = (f, maxLevel = 2, maxChildren = 5, mode = "harmonic", customRatios = null) => {
	// Create the root node (base frequency)
	const root = {
		id: 'root',
		name: `Base: ${f.toFixed(2)} Hz`,
		value: f,
		level: -1,
		nodeType: 'root',
		baseFreq: f,
		recursionIndices: [],
		children: []
	};
	
	return root;
};

// Generate children for a node on-demand with simplified structure
const generateChildrenForNode = (node, baseFreq, maxChildren, mode, maxLevel, customRatios = null) => {
	if (!node) return null;
	
	// If this is the root node, generate H^0 frequencies
	if (node.nodeType === 'root') {
		const h0Frequencies = generateBaseFrequencies(baseFreq, maxChildren, mode, customRatios);
		return h0Frequencies.map((freq, i) => ({
			id: `h0-${i}`,
			name: `${freq.toFixed(1)} Hz (H^0[${i}])`,
			value: freq,
			level: 0,
			nodeType: 'frequency',
			index: i,
			baseFreq: baseFreq,
			recursionIndices: [i],
			children: []
		}));
	}
	
	// If this is a frequency node, generate its H^1 frequencies
	if (node.nodeType === 'frequency') {
		const currentLevel = node.level;
		const nextLevel = currentLevel + 1;
		
		// Don't generate beyond maxLevel
		if (nextLevel > maxLevel) return [];
		
		// Generate H^1 frequencies for this specific frequency
		const frequencies = generateBaseFrequencies(node.value, maxChildren, mode, customRatios);
		return frequencies.map((freq, i) => ({
			id: `h${nextLevel}-${node.id}-${i}`,
			name: `${freq.toFixed(1)} Hz (H^${nextLevel}[${[...node.recursionIndices, i].join(',')}])`,
			value: freq,
			level: nextLevel,
			nodeType: 'frequency',
			index: i,
			baseFreq: node.baseFreq,
			parentFreq: node.value,
			recursionIndices: [...(node.recursionIndices || []), i],
			children: []
		}));
	}
	
	// Default return empty array
	return [];
};

// Updated close frequencies finder that includes path information
const findCloseFrequencies = (structure, threshold = 0.01) => {
	const allFreqs = extractAllFrequenciesWithPaths(structure);
	const closePairs = [];
	
	for (let i = 0; i < allFreqs.length; i++) {
		for (let j = i + 1; j < allFreqs.length; j++) {
			const freq1 = allFreqs[i];
			const freq2 = allFreqs[j];
			
			// Check if frequencies are valid numbers
			if (!freq1 || !freq2 || 
				typeof freq1.frequency !== 'number' || 
				typeof freq2.frequency !== 'number' ||
				isNaN(freq1.frequency) || isNaN(freq2.frequency)) {
				continue;
			}
			
			// Calculate relative difference
			const relDiff = Math.abs(freq1.frequency - freq2.frequency) / Math.max(freq1.frequency, freq2.frequency);
			
			if (relDiff < threshold && relDiff > 0) {  // Avoid exact matches
				closePairs.push({
					freq1: freq1.frequency,
					freq2: freq2.frequency,
					path1: freq1.pathString,
					path2: freq2.pathString,
					difference: relDiff,
					level1: freq1.level,
					level2: freq2.level
				});
			}
		}
	}
	
	return closePairs;
};

const analyzeFrequencyRatios = (structure, maxDenominator = 12) => {
	const allFreqs = extractAllFrequenciesWithPaths(structure);
	const ratios = [];
	
	for (let i = 0; i < allFreqs.length && i < 100; i++) {
		for (let j = i + 1; j < allFreqs.length && j < 100; j++) {
			const freq1 = allFreqs[i];
			const freq2 = allFreqs[j];
			
			// Check if frequencies are valid numbers
			if (!freq1 || !freq2 || 
				typeof freq1.frequency !== 'number' || 
				typeof freq2.frequency !== 'number' ||
				isNaN(freq1.frequency) || isNaN(freq2.frequency)) {
				continue;
			}
			
			const actualRatio = freq1.frequency < freq2.frequency ? 
				freq1.frequency / freq2.frequency : 
				freq2.frequency / freq1.frequency;
			
			// Find closest simple ratio
			let bestDiff = Infinity;
			let bestRatio = [0, 0];
			
			for (let denom = 1; denom <= maxDenominator; denom++) {
				for (let num = 1; num <= denom; num++) {
					if (gcd(num, denom) === 1) {  // Ensure reduced fraction
						const ratio = num / denom;
						const diff = Math.abs(actualRatio - ratio);
						
						if (diff < bestDiff) {
							bestDiff = diff;
							bestRatio = [num, denom];
						}
					}
				}
			}
			
			ratios.push({
				freq1: freq1.frequency,
				freq2: freq2.frequency,
				path1: freq1.pathString,
				path2: freq2.pathString,
				actualRatio: actualRatio,
				simpleRatio: bestRatio,
				difference: bestDiff
			});
		}
	}
	
	return ratios;
};

// Simple, robust Phase Space Component
const PhaseSpaceView = ({ structure, baseFreq, nHarmonics, mode }) => {
	const [viewType, setViewType] = useState('2d-ratios');
	
	if (!structure) return null;
	
	// Extract all frequencies with their paths and levels
	const allFreqs = extractAllFrequenciesWithPaths(structure);
	
	console.log('Starting phase space analysis...');
	console.log('Total frequencies:', allFreqs.length);
	
	// Simple, direct approach - calculate ratios for harmonic series only
	const phaseSpaceData = [];
	
	// Get base frequency
	const baseFreqData = allFreqs.find(f => f.level === -1);
	if (!baseFreqData) {
		console.log('No base frequency found');
		return <div>No base frequency found</div>;
	}
	
	// Get H^0 frequencies (should be harmonic series from base)
	const h0Freqs = allFreqs.filter(f => f.level === 0).slice(0, 8); // Limit to first 8 for clarity
	
	console.log('H^0 frequencies:', h0Freqs.length);
	
	h0Freqs.forEach((h0, index) => {
		// Find corresponding H^1 frequencies (harmonics of this H^0)
		const h1Freqs = allFreqs.filter(f => 
			f.level === 1 && 
			f.path.length >= 2 && 
			f.path[0] === index
		).slice(0, 8); // Limit to first 8
		
		h1Freqs.forEach((h1, h1Index) => {
			// Find corresponding H^2 frequencies
			const h2Freqs = allFreqs.filter(f =>
				f.level === 2 && 
				f.path.length >= 3 &&
				f.path[0] === index &&
				f.path[1] === h1Index
			).slice(0, 4); // Limit to first 4
			
			h2Freqs.forEach((h2) => {
				// Calculate ratios - be very careful about division
				if (h0.frequency > 0 && h1.frequency > 0 && h2.frequency > 0) {
					const ratio01 = h1.frequency / h0.frequency;
					const ratio12 = h2.frequency / h1.frequency;
					
					// Only accept reasonable musical ratios
					if (ratio01 >= 1 && ratio01 <= 8 && ratio12 >= 1 && ratio12 <= 8) {
						phaseSpaceData.push({
							x: ratio01,
							y: ratio12,
							pathKey: `${index}-${h1Index}-${h2.path[2]}`,
							ratio01: ratio01,
							ratio12: ratio12,
							isStable: Math.abs(ratio01 - ratio12) < 0.05,
							stabilityError: Math.abs(ratio01 - ratio12),
							avgRatio: (ratio01 + ratio12) / 2
						});
					}
				}
			});
		});
	});
	
	console.log('Valid phase space points:', phaseSpaceData.length);
	if (phaseSpaceData.length > 0) {
		console.log('Ratio ranges:', {
			minX: Math.min(...phaseSpaceData.map(d => d.x)),
			maxX: Math.max(...phaseSpaceData.map(d => d.x)),
			minY: Math.min(...phaseSpaceData.map(d => d.y)),
			maxY: Math.max(...phaseSpaceData.map(d => d.y))
		});
		console.log('Sample points:', phaseSpaceData.slice(0, 3));
	}
	
	// Create ONLY diagonal line within the data range
	const diagonalData = [];
	if (phaseSpaceData.length > 0) {
		const minRatio = Math.max(1, Math.min(...phaseSpaceData.map(d => Math.min(d.x, d.y))));
		const maxRatio = Math.min(8, Math.max(...phaseSpaceData.map(d => Math.max(d.x, d.y))));
		
		console.log('Diagonal range:', minRatio, 'to', maxRatio);
		
		for (let i = 0; i <= 50; i++) {
			const r = minRatio + (maxRatio - minRatio) * (i / 50);
			diagonalData.push({ x: r, y: r, isDiagonal: true });
		}
	}
	
	// Simple color coding
	const getPointColor = (point) => {
		if (point.isStable) return '#ff0000'; // Red for stable
		
		// Color by position relative to diagonal
		const distance = Math.abs(point.x - point.y);
		if (distance < 0.1) return '#ff6600'; // Orange - close to stable
		if (distance < 0.3) return '#0066ff'; // Blue - moderate drift
		return '#666666'; // Gray - high drift
	};
	
	// Combine data carefully
	const chartData = [...diagonalData, ...phaseSpaceData];
	
	return (
		<div className="phase-space-container">
			<div className="phase-space-controls">
				<h3 className="phase-space-title">Phase Space - Harmonic Ratios (Simplified)</h3>
				<p style={{ fontSize: '0.8rem', color: '#666', margin: '4px 0' }}>
					Showing ratios between consecutive recursion levels (limited to reasonable musical ranges)
				</p>
			</div>
			
			<div style={{ 
				height: '600px', 
				border: '1px solid #e1e5e9', 
				borderRadius: '3px', 
				padding: '12px', 
				background: '#fafafa' 
			}}>
				{phaseSpaceData.length > 0 ? (
					<ResponsiveContainer width="100%" height="100%">
						<LineChart 
							data={chartData}
							margin={{ top: 20, right: 30, left: 60, bottom: 60 }}
						>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis 
								type="number"
								dataKey="x"
								domain={[1, 8]}
								label={{ value: 'Ratio H^0 → H^1', position: 'insideBottom', offset: -5 }}
							/>
							<YAxis 
								type="number"
								dataKey="y"
								domain={[1, 8]}
								label={{ value: 'Ratio H^1 → H^2', angle: -90, position: 'insideLeft' }}
							/>
							<Tooltip 
								formatter={(value, name, props) => {
									if (props?.payload?.pathKey) {
										return [
											`${value.toFixed(3)}`, 
											`Path: ${props.payload.pathKey} - ${props.payload.isStable ? 'STABLE' : `Drift: ${props.payload.stabilityError.toFixed(3)}`}`
										];
									} else if (props?.payload?.isDiagonal) {
										return [`${value.toFixed(3)}`, 'Perfect Stability Line'];
									}
									return [value?.toFixed(3) || value, name];
								}}
							/>
							<Legend />
							
							{/* Diagonal stability line */}
							<Line 
								dataKey="y"
								stroke="#cccccc"
								strokeWidth={2}
								strokeDasharray="5,5"
								dot={false}
								line={true}
								connectNulls={true}
								name="Perfect Stability (y=x)"
								data={diagonalData}
							/>
							
							{/* Phase space points */}
							<Line 
								dataKey="y"
								stroke="transparent"
								strokeWidth={0}
								dot={(props) => {
									if (props.payload?.pathKey) {
										const point = props.payload;
										return <circle 
											cx={props.cx} 
											cy={props.cy} 
											r={point.isStable ? 5 : 3}
											fill={getPointColor(point)}
											stroke="white" 
											strokeWidth={1}
											style={{ cursor: 'pointer' }}
										/>;
									}
									return null;
								}}
								line={false}
								name="Harmonic Ratios"
								data={phaseSpaceData}
							/>
						</LineChart>
					</ResponsiveContainer>
				) : (
					<div style={{ 
						display: 'flex', 
						flexDirection: 'column',
						alignItems: 'center', 
						justifyContent: 'center', 
						height: '100%', 
						color: '#666'
					}}>
						<p>No valid harmonic ratio data found.</p>
						<p style={{ fontSize: '0.9rem' }}>Recursion level: {structure?.levels?.length || 0}</p>
						<p style={{ fontSize: '0.9rem' }}>Try harmonic series mode with recursion level 2+</p>
					</div>
				)}
			</div>
			
			<div style={{ 
				marginTop: '12px', 
				padding: '12px', 
				background: '#f8f9fa', 
				borderRadius: '3px', 
				fontSize: '0.85rem', 
				color: '#666' 
			}}>
				<p><strong>Data points:</strong> {phaseSpaceData.length} | <strong>Stable:</strong> {phaseSpaceData.filter(d => d.isStable).length}</p>
				<p><strong>Colors:</strong> <span style={{color: '#ff0000'}}>Red=Stable</span> | <span style={{color: '#ff6600'}}>Orange=Near-stable</span> | <span style={{color: '#0066ff'}}>Blue=Drift</span></p>
			</div>
		</div>
	);
};

// Side View Component for frequency plotting - UPDATED VERSION
const SideView = ({ structure, baseFreq, nHarmonics, mode }) => {
	const [scaleType, setScaleType] = useState('linear');
	
	if (!structure) return null;
	
	// Extract all frequencies with level and path information
	const allFreqs = extractAllFrequenciesWithPaths(structure);
	
	// Group frequencies by their complete path to create columns
	const frequencySets = [];
	
	// Add base frequency as first column
	const baseFreqItem = allFreqs.find(f => f.level === -1);
	if (baseFreqItem) {
		frequencySets.push({
			setName: 'Base',
			setIndex: 0,
			frequencies: [baseFreqItem.frequency],
			level: -1,
			color: '#8B4513'
		});
	}
	
	// Add H^0 frequencies as second column
	const h0Frequencies = allFreqs.filter(f => f.level === 0).map(f => f.frequency);
	if (h0Frequencies.length > 0) {
		frequencySets.push({
			setName: 'H^0',
			setIndex: 1,
			frequencies: h0Frequencies,
			level: 0,
			color: '#4682B4'
		});
	}
	
	// Add H^1 sets - each H^0 frequency generates its own set
	const h1Groups = {};
	allFreqs.filter(f => f.level === 1).forEach(freq => {
		// Extract the first index from the path (which H^0 frequency this came from)
		const parentIndex = freq.path[0];
		const setKey = `H^1[${parentIndex}]`;
		
		if (!h1Groups[setKey]) {
			h1Groups[setKey] = [];
		}
		h1Groups[setKey].push(freq.frequency);
	});
	
	// Sort H^1 groups by parent index and add to frequency sets
	Object.keys(h1Groups).sort((a, b) => {
		const indexA = parseInt(a.match(/\[(\d+)\]/)[1]);
		const indexB = parseInt(b.match(/\[(\d+)\]/)[1]);
		return indexA - indexB;
	}).forEach((setKey, idx) => {
		frequencySets.push({
			setName: setKey,
			setIndex: frequencySets.length,
			frequencies: h1Groups[setKey],
			level: 1,
			color: '#228B22'
		});
	});
	
	// Add H^2 sets - each H^1 frequency generates its own set
	const h2Groups = {};
	allFreqs.filter(f => f.level === 2).forEach(freq => {
		// Extract the path to create a unique set identifier
		const setKey = `H^2[${freq.path.slice(0, 2).join(',')}]`;
		
		if (!h2Groups[setKey]) {
			h2Groups[setKey] = [];
		}
		h2Groups[setKey].push(freq.frequency);
	});
	
// Sort H^2 groups and add to frequency sets - FIXED NUMERIC SORTING
	Object.keys(h2Groups).sort((a, b) => {
		// Extract indices from strings like "H^2[0,1]" and "H^2[1,0]"
		const indicesA = a.match(/\[([^\]]+)\]/)[1].split(',').map(n => parseInt(n.trim()));
		const indicesB = b.match(/\[([^\]]+)\]/)[1].split(',').map(n => parseInt(n.trim()));
		
		// Compare first index, then second index if first are equal
		for (let i = 0; i < Math.max(indicesA.length, indicesB.length); i++) {
			const aVal = indicesA[i] || 0;
			const bVal = indicesB[i] || 0;
			if (aVal !== bVal) {
				return aVal - bVal;
			}
		}
		return 0;
	}).forEach((setKey) => {
		frequencySets.push({
			setName: setKey,
			setIndex: frequencySets.length,
			frequencies: h2Groups[setKey],
			level: 2,
			color: '#8A2BE2'
		});
	});
	
	// Add H^3 sets if they exist
	const h3Groups = {};
	allFreqs.filter(f => f.level === 3).forEach(freq => {
		const setKey = `H^3[${freq.path.slice(0, 3).join(',')}]`;
		
		if (!h3Groups[setKey]) {
			h3Groups[setKey] = [];
		}
		h3Groups[setKey].push(freq.frequency);
	});
	
	Object.keys(h3Groups).sort((a, b) => {
		// Extract indices from strings like "H^3[0,1,2]" and "H^3[1,0,3]"
		const indicesA = a.match(/\[([^\]]+)\]/)[1].split(',').map(n => parseInt(n.trim()));
		const indicesB = b.match(/\[([^\]]+)\]/)[1].split(',').map(n => parseInt(n.trim()));
		
		// Compare each index in order
		for (let i = 0; i < Math.max(indicesA.length, indicesB.length); i++) {
			const aVal = indicesA[i] || 0;
			const bVal = indicesB[i] || 0;
			if (aVal !== bVal) {
				return aVal - bVal;
			}
		}
		return 0;
	}).forEach((setKey) => {
		frequencySets.push({
			setName: setKey,
			setIndex: frequencySets.length,
			frequencies: h3Groups[setKey],
			level: 3,
			color: '#FF6347'
		});
	});
	
	// Prepare data for recharts - each frequency becomes a point
	const chartData = [];
	frequencySets.forEach((set, setIndex) => {
		set.frequencies.forEach((freq, freqIndex) => {
			chartData.push({
				setIndex: setIndex,
				setName: set.setName,
				frequency: freq,
				level: set.level,
				color: set.color,
				freqIndexInSet: freqIndex,
				pointId: `${setIndex}-${freqIndex}`
			});
		});
	});
	
	const colors = {
		'Base': '#8B4513',
		'H^0': '#4682B4', 
		'H^1': '#228B22',
		'H^2': '#8A2BE2',
		'H^3': '#FF6347'
	};
	
	// Get level colors for legend
	const levelColors = (level) => {
		if (level === -1) return colors.Base;
		return colors[`H^${level}`] || '#666';
	};
	
	return (
		<div className="side-view-container">
			<div className="side-view-controls">
				<h3 className="side-view-title">Side View - Frequency Sets</h3>
				<div className="scale-controls">
					<button 
						className={`scale-btn ${scaleType === 'linear' ? 'active' : ''}`}
						onClick={() => setScaleType('linear')}
					>
						Linear Scale
					</button>
					<button 
						className={`scale-btn ${scaleType === 'log' ? 'active' : ''}`}
						onClick={() => setScaleType('log')}
					>
						Log Scale
					</button>
				</div>
			</div>
			
			<div className="chart-container" style={{ height: '960px' }}>
				<ResponsiveContainer width="100%" height="100%">
					<LineChart data={chartData} margin={{ top: 20, right: 30, left: 120, bottom: 100 }}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis 
							dataKey="setIndex"
							domain={[0, frequencySets.length - 1]}
							type="number"
							tickFormatter={(value) => {
								const set = frequencySets[value];
								return set ? set.setName : '';
							}}
							interval={0}
							angle={-45}
							textAnchor="end"
							height={80}
							label={{ value: 'Frequency Sets', position: 'insideBottom' }}
						/>
						<YAxis 
							scale={scaleType}
							domain={scaleType === 'log' ? ['dataMin', 'dataMax'] : [0, 'dataMax']}
							label={{ value: 'Frequency (Hz)', angle: -90, position: 'insideLeft' }}
						/>
						<Tooltip 
							formatter={(value, name, props) => [
								`${value.toFixed(2)} Hz`, 
								`${props.payload.setName} [${props.payload.freqIndexInSet}]`
							]}
							labelFormatter={(setIndex) => {
								const set = frequencySets[setIndex];
								return set ? `Set: ${set.setName}` : `Set ${setIndex}`;
							}}
						/>
						<Legend />
						
						{/* Base frequency */}
						<Line 
							dataKey="frequency" 
							stroke={colors.Base}
							strokeWidth={0}
							dot={(props) => {
								if (props.payload && props.payload.level === -1) {
									return <circle cx={props.cx} cy={props.cy} r={8} fill={colors.Base} stroke="white" strokeWidth={2} />;
								}
								return null;
							}}
							line={false}
							connectNulls={false}
							name="Base"
						/>
						
						{/* H^0 frequencies */}
						<Line 
							dataKey="frequency" 
							stroke={colors['H^0']}
							strokeWidth={0}
							dot={(props) => {
								if (props.payload && props.payload.level === 0) {
									return <circle cx={props.cx} cy={props.cy} r={5} fill={colors['H^0']} stroke="white" strokeWidth={1} />;
								}
								return null;
							}}
							line={false}
							connectNulls={false}
							name="H^0"
						/>
						
						{/* H^1 frequencies */}
						<Line 
							dataKey="frequency" 
							stroke={colors['H^1']}
							strokeWidth={0}
							dot={(props) => {
								if (props.payload && props.payload.level === 1) {
									return <circle cx={props.cx} cy={props.cy} r={4} fill={colors['H^1']} stroke="white" strokeWidth={1} />;
								}
								return null;
							}}
							line={false}
							connectNulls={false}
							name="H^1"
						/>
						
						{/* H^2 frequencies */}
						<Line 
							dataKey="frequency" 
							stroke={colors['H^2']}
							strokeWidth={0}
							dot={(props) => {
								if (props.payload && props.payload.level === 2) {
									return <circle cx={props.cx} cy={props.cy} r={3} fill={colors['H^2']} stroke="white" strokeWidth={1} />;
								}
								return null;
							}}
							line={false}
							connectNulls={false}
							name="H^2"
						/>
						
						{/* H^3 frequencies */}
						<Line 
							dataKey="frequency" 
							stroke={colors['H^3']}
							strokeWidth={0}
							dot={(props) => {
								if (props.payload && props.payload.level === 3) {
									return <circle cx={props.cx} cy={props.cy} r={2} fill={colors['H^3']} stroke="white" strokeWidth={1} />;
								}
								return null;
							}}
							line={false}
							connectNulls={false}
							name="H^3"
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>
			
			<div className="side-view-stats">
				<p><strong>Total frequency sets:</strong> {frequencySets.length}</p>
				<p><strong>Total frequencies:</strong> {chartData.length}</p>
				<p><strong>Range:</strong> {Math.min(...chartData.map(d => d.frequency)).toFixed(2)} - {Math.max(...chartData.map(d => d.frequency)).toFixed(2)} Hz</p>
				
				<div style={{ marginTop: '8px' }}>
					<strong>Sets by level: </strong>
					{Object.entries(frequencySets.reduce((acc, set) => {
						const levelKey = set.level === -1 ? 'Base' : `H^${set.level}`;
						acc[levelKey] = (acc[levelKey] || 0) + 1;
						return acc;
					}, {})).map(([level, count]) => (
						<span key={level} style={{ color: colors[level] || '#666', marginRight: '12px' }}>
							{level}: {count} sets
						</span>
					))}
				</div>
			</div>
		</div>
	);
};

// Fixed Hierarchical Tree Visualization Component
const HierarchicalTree = ({ data, baseFreq, nHarmonics, mode, threshold, maxLevel, customRatios }) => {
	const svgRef = useRef(null);
	const zoomRef = useRef(null);
	const transformRef = useRef(null);
	const [expandedNodes, setExpandedNodes] = useState(new Set(['root']));
	const [treeData, setTreeData] = useState(data);
	const [showCloseMatches, setShowCloseMatches] = useState(false);
	const [closeMatches, setCloseMatches] = useState([]);
	
	// Update internal tree data when the data prop changes (e.g., mode switch)
	useEffect(() => {
		setTreeData(data);
	}, [data]);
	
	// Toggle node expansion with improved logic
	const toggleNode = (nodeId) => {
		const newExpanded = new Set(expandedNodes);
		
		if (newExpanded.has(nodeId)) {
			// Collapse: remove this node and all descendants
			const toRemove = Array.from(newExpanded).filter(id => 
				id === nodeId || id.startsWith(`${nodeId}-`) || id.includes(`-${nodeId}-`)
			);
			toRemove.forEach(id => newExpanded.delete(id));
		} else {
			// Expand: add this node
			newExpanded.add(nodeId);
			
			// Find the node in the tree and generate children if needed
			const findAndUpdateNode = (currentNode, targetId) => {
				if (currentNode.id === targetId) {
					if (!currentNode.children || currentNode.children.length === 0) {
						const newChildren = generateChildrenForNode(currentNode, baseFreq, nHarmonics, mode, maxLevel, customRatios);
						if (newChildren && newChildren.length > 0) {
							currentNode.children = newChildren;
							return true;
						}
					}
					return false;
				}
				
				if (currentNode.children) {
					for (let child of currentNode.children) {
						if (findAndUpdateNode(child, targetId)) {
							return true;
						}
					}
				}
				return false;
			};
			
			// Create a new tree data object if we updated anything
			const newTreeData = JSON.parse(JSON.stringify(treeData));
			if (findAndUpdateNode(newTreeData, nodeId)) {
				setTreeData(newTreeData);
			}
		}
		
		setExpandedNodes(newExpanded);
	};
	
	// Fixed positioning algorithm to prevent overlaps
	const getVisibleNodes = (node, result = [], parent = null) => {
		if (!node) return result;
		
		const isExpanded = expandedNodes.has(node.id);
		
		const nodeInfo = {
			id: node.id,
			name: node.name,
			value: node.value,
			nodeType: node.nodeType,
			level: node.level,
			hasChildren: node.children && node.children.length > 0,
			isExpanded: isExpanded,
			parent: parent,
			x: 0,
			y: 0
		};
		
		result.push(nodeInfo);
		
		if (isExpanded && node.children && node.children.length > 0) {
			node.children.forEach((child) => {
				getVisibleNodes(child, result, nodeInfo);
			});
		}
		
		return result;
	};
	
	// Calculate positions for all visible nodes to prevent overlaps
	const calculatePositions = (visibleNodes) => {
		const horizontalSpacing = 250;
		
		// Position root node first
		const rootNode = visibleNodes.find(n => n.nodeType === 'root');
		if (rootNode) {
			rootNode.x = 50;
			rootNode.y = 200;
		}
		
		// Group nodes by level for processing
		const nodesByLevel = {};
		visibleNodes.forEach(node => {
			if (!nodesByLevel[node.level]) {
				nodesByLevel[node.level] = [];
			}
			nodesByLevel[node.level].push(node);
		});
		
		// Count total number of visible nodes and parent groups for dynamic spacing
		let totalParentGroups = 0;
		let totalNodes = visibleNodes.filter(n => n.nodeType === 'frequency').length;
		const levels = Object.keys(nodesByLevel).map(l => parseInt(l)).sort((a, b) => a - b);
		
		levels.forEach(level => {
			if (level === -1) return;
			const levelNodes = nodesByLevel[level];
			const uniqueParents = new Set(levelNodes.map(node => node.parent ? node.parent.id : 'none'));
			totalParentGroups += uniqueParents.size;
		});
		
		// Calculate dynamic spacing based on total node density
		const minNodeSpacing = 20;
		const maxNodeSpacing = 50;
		const minGroupSpacing = 10;
		const maxGroupSpacing = 40;
		
		// More nodes = tighter spacing
		const nodeSpacingFactor = Math.max(0, Math.min(1, (60 - totalNodes) / 60));
		const nodeSpacing = minNodeSpacing + (maxNodeSpacing - minNodeSpacing) * nodeSpacingFactor;
		const groupSpacing = minGroupSpacing + (maxGroupSpacing - minGroupSpacing) * nodeSpacingFactor;
		
		// Process each level in order
		levels.forEach(level => {
			if (level === -1) return; // Skip root level
			
			const levelNodes = nodesByLevel[level];
			
			// Group nodes by their parent
			const nodesByParent = {};
			levelNodes.forEach(node => {
				const parentId = node.parent ? node.parent.id : 'none';
				if (!nodesByParent[parentId]) {
					nodesByParent[parentId] = [];
				}
				nodesByParent[parentId].push(node);
			});
			
			// Position each parent's children
			let globalY = -10; // Start from top for this level
			let isFirstGroup = true;

			Object.values(nodesByParent).forEach(siblings => {
				if (siblings.length === 0) return;
				
				const parent = siblings[0].parent;
				if (!parent) return;
				
				// Calculate positions for this sibling group with dynamic spacing
				const x = parent.x + horizontalSpacing;
				const groupHeight = (siblings.length - 1) * nodeSpacing;
				
				// For the first group, allow centering around parent; for subsequent groups, avoid overlap
				let startY;
				if (isFirstGroup) {
					startY = Math.max(-500, parent.y - 100); // Allow going higher, but not above absolute top
					isFirstGroup = false;
				} else {
					startY = Math.max(globalY, parent.y - 200);
				}
				
				siblings.forEach((node, index) => {
					node.x = x;
					node.y = startY + (index * nodeSpacing);
				});
				
				// Update global Y to prevent overlap with next group - use dynamic spacing
				globalY = Math.max(globalY, startY + groupHeight + groupSpacing);
			});
		});
		
		return visibleNodes;
	};

	// Calculate frequency matches when requested
	const findMatches = () => {
		const allFrequencies = [];
		const rawVisibleNodes = getVisibleNodes(treeData);
		const visibleNodes = calculatePositions(rawVisibleNodes);
		
		visibleNodes.forEach(node => {
			if (node.value && node.nodeType === 'frequency') {
				allFrequencies.push({
					id: node.id,
					freq: node.value,
					x: node.x,
					y: node.y,
					name: node.name
				});
			}
		});
		
		// Find close matches
		const matches = [];
		for (let i = 0; i < allFrequencies.length; i++) {
			for (let j = i + 1; j < allFrequencies.length; j++) {
				const f1 = allFrequencies[i];
				const f2 = allFrequencies[j];
				
				// Calculate relative difference
				const relDiff = Math.abs(f1.freq - f2.freq) / Math.max(f1.freq, f2.freq);
				
				if (relDiff < threshold && relDiff > 0) {
					matches.push({
						id1: f1.id,
						id2: f2.id,
						freq1: f1.freq,
						freq2: f2.freq,
						x1: f1.x,
						x2: f2.x,
						y1: f1.y,
						y2: f2.y,
						difference: relDiff,
						name1: f1.name,
						name2: f2.name
					});
				}
			}
		}
		
		setCloseMatches(matches);
	};
	
	// Render the tree visualization with D3
	useEffect(() => {
		// Check if d3 is available, if not load it
		if (typeof window.d3 === 'undefined') {
			const script = document.createElement('script');
			script.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js';
			script.onload = () => {
				renderTree();
			};
			document.head.appendChild(script);
		} else {
			renderTree();
		}

		function renderTree() {
			if (!svgRef.current || typeof window.d3 === 'undefined') return;
			
			const d3 = window.d3;
			
			// Get visible nodes and calculate positions properly
			const rawVisibleNodes = getVisibleNodes(treeData);
			const visibleNodes = calculatePositions(rawVisibleNodes);
			
			// Ensure we have valid nodes
			if (!visibleNodes || visibleNodes.length === 0) return;
			
			// Calculate dimensions based on actual node positions
			const nodeRadius = 8;
			const padding = 100;
			const minX = Math.min(...visibleNodes.map(n => n.x || 0));
			const maxX = Math.max(...visibleNodes.map(n => n.x || 0));
			const minY = Math.min(...visibleNodes.map(n => n.y || 0));
			const maxY = Math.max(...visibleNodes.map(n => n.y || 0));
			
			const width = Math.max(800, maxX - minX + padding * 2);
			const height = Math.max(600, maxY - minY + padding * 2);
			
			// Create SVG
			const svg = d3.select(svgRef.current);
			svg.selectAll("*").remove();
			
			// Create zoom behavior if it doesn't exist
			if (!zoomRef.current) {
				zoomRef.current = d3.zoom()
					.scaleExtent([0.1, 3])
					.on("zoom", (event) => {
						transformRef.current = event.transform;
						g.attr("transform", event.transform);
					});
			}
			
			const svgContainer = svg
				.attr("width", "100%")
				.attr("height", height)
				.attr("viewBox", `${minX - padding} ${minY - padding} ${width} ${height}`)
				.call(zoomRef.current);
			
			// Background for zoom/pan
			svgContainer.append("rect")
				.attr("x", minX - padding)
				.attr("y", minY - padding)
				.attr("width", width)
				.attr("height", height)
				.attr("fill", "transparent")
				.attr("pointer-events", "all");
			
			const g = svgContainer.append("g");
			
			// Restore previous transform if it exists, otherwise set initial transform
			if (transformRef.current) {
				svg.call(zoomRef.current.transform, transformRef.current);
			} else {
				// Set initial transform to center the root node
				const initialTransform = d3.zoomIdentity.translate(0, 0).scale(1);
				transformRef.current = initialTransform;
				svg.call(zoomRef.current.transform, initialTransform);
			}
			
			// Draw connection lines
			const links = [];
			visibleNodes.forEach(node => {
				if (node.parent) {
					links.push({
						source: node.parent,
						target: node
					});
				}
			});
			
			g.selectAll("line.tree-link")
				.data(links)
				.enter()
				.append("line")
				.attr("class", "tree-link")
				.attr("x1", d => d.source.x + nodeRadius)
				.attr("y1", d => d.source.y)
				.attr("x2", d => d.target.x - nodeRadius)
				.attr("y2", d => d.target.y)
				.attr("stroke", "#999")
				.attr("stroke-width", 1);
			
			// Draw close matches if enabled
			if (showCloseMatches) {
				g.selectAll(".match-line")
					.data(closeMatches)
					.enter()
					.append("line")
					.attr("class", "match-line")
					.attr("x1", d => {
						const node1 = visibleNodes.find(n => n.id === d.id1);
						return node1 ? node1.x + nodeRadius : 0;
					})
					.attr("y1", d => {
						const node1 = visibleNodes.find(n => n.id === d.id1);
						return node1 ? node1.y : 0;
					})
					.attr("x2", d => {
						const node2 = visibleNodes.find(n => n.id === d.id2);
						return node2 ? node2.x - nodeRadius : 0;
					})
					.attr("y2", d => {
						const node2 = visibleNodes.find(n => n.id === d.id2);
						return node2 ? node2.y : 0;
					})
					.attr("stroke", d => {
						const colorScale = d3.scaleLinear()
							.domain([0, threshold])
							.range(["red", "orange"]);
						return colorScale(d.difference);
					})
					.attr("stroke-width", d => 3 - (d.difference / threshold) * 2)
					.attr("stroke-dasharray", "5,5");
			}
			
			// Create tooltip
			const tooltip = d3.select("body")
				.append("div")
				.attr("class", "node-tooltip")
				.style("position", "fixed")
				.style("background", "white")
				.style("border", "1px solid #ddd")
				.style("border-radius", "5px")
				.style("padding", "10px")
				.style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
				.style("display", "none")
				.style("z-index", "1000")
				.style("pointer-events", "none");
			
			// Create node groups
			const nodeGroups = g.selectAll(".node")
				.data(visibleNodes)
				.enter()
				.append("g")
				.attr("class", "node")
				.attr("transform", d => `translate(${d.x},${d.y})`)
				.style("cursor", d => (d.hasChildren || d.nodeType === 'frequency' || d.nodeType === 'root') ? "pointer" : "default")
				.on("click", function(event, d) {
					// Prevent zoom behavior from interfering
					event.stopPropagation();
					event.preventDefault();
					
					// Add a small delay to ensure the click is processed after any zoom events
					setTimeout(() => {
						if (d.hasChildren || d.nodeType === 'frequency' || d.nodeType === 'root') {
							toggleNode(d.id);
						}
					}, 0);
				});
			
			// Draw circles for all nodes
			nodeGroups.append("circle")
				.attr("r", d => d.nodeType === 'root' ? 12 : 8)
				.attr("fill", d => {
					if (d.nodeType === 'root') return "#8B4513";
					const colors = ["#4682B4", "#228B22", "#8A2BE2", "#FF6347", "#32CD32"];
					return colors[d.level % colors.length];
				})
				.attr("stroke", d => d.isExpanded ? "#333" : "#999")
				.attr("stroke-width", 1);
			
			// Add expansion indicators
			nodeGroups.filter(d => d.hasChildren)
				.append("text")
				.attr("text-anchor", "middle")
				.attr("dy", ".3em")
				.text(d => d.isExpanded ? "-" : "+")
				.attr("fill", "white")
				.attr("font-family", "Arial")
				.attr("font-size", "10px")
				.attr("pointer-events", "none");
			
			// Add node labels
			nodeGroups.append("text")
				.attr("x", 20)
				.attr("dy", ".35em")
				.attr("text-anchor", "start")
				.text(d => d.name)
				.attr("font-family", "Arial")
				.attr("font-size", "12px")
				.attr("font-weight", d => d.nodeType === 'root' ? "bold" : "normal");
			
			// Add hover behavior
			nodeGroups
				.on("mouseenter", (event, d) => {
					let tooltipContent = `<div><strong>${d.name}</strong>`;
					if (d.value) tooltipContent += `<p>Frequency: ${d.value.toFixed(2)} Hz</p>`;
					if (d.level >= 0) tooltipContent += `<p>Level: H^${d.level}</p>`;
					tooltipContent += `</div>`;
					
					tooltip
						.html(tooltipContent)
						.style("display", "block")
						.style("left", (event.clientX + 15) + "px")
						.style("top", (event.clientY - 15) + "px");
				})
				.on("mousemove", (event) => {
					tooltip
						.style("left", (event.clientX + 15) + "px")
						.style("top", (event.clientY - 15) + "px");
				})
				.on("mouseleave", () => {
					tooltip.style("display", "none");
				});
		}
		
		return () => {
			// Cleanup
			const tooltips = document.querySelectorAll('.node-tooltip');
			tooltips.forEach(tooltip => tooltip.remove());
			
			// Reset zoom refs when component unmounts
			if (treeData !== data) {
				zoomRef.current = null;
				transformRef.current = null;
			}
		};
	}, [treeData, expandedNodes, showCloseMatches, closeMatches]);
	
	// Effect to find matches when toggled
	useEffect(() => {
		if (showCloseMatches) {
			findMatches();
		}
	}, [showCloseMatches, expandedNodes]);
	
	// Reset zoom and expanded nodes when fundamental tree parameters change
	useEffect(() => {
		zoomRef.current = null;
		transformRef.current = null;
		setExpandedNodes(new Set(['root'])); // Reset to only root expanded
	}, [baseFreq, nHarmonics, mode, maxLevel]);
	
	return (
		<div className="tree-container">
			<div className="tree-controls">
				<h3 className="tree-title">Recursive Harmonic Frequency Tree</h3>
				<div className="tree-actions">
					<button 
						className={`close-matches-btn ${showCloseMatches ? 'active' : ''}`}
						onClick={() => setShowCloseMatches(!showCloseMatches)}
					>
						{showCloseMatches ? 'Hide Close Matches' : 'Show Close Matches'}
					</button>
					<span className="tree-hint">Click nodes to expand/collapse. Each level shows harmonic relationships.</span>
				</div>
			</div>
			
			<div className="tree-viewport">
				<svg ref={svgRef} width="100%" height="600"></svg>
			</div>
			
			{showCloseMatches && closeMatches.length > 0 && (
				<div className="matches-table">
					<h4 className="matches-title">Close Frequency Matches</h4>
					<div className="matches-scroll">
						<table className="matches">
							<thead>
								<tr>
									<th>Frequency 1</th>
									<th>Frequency 2</th>
									<th>Difference (%)</th>
								</tr>
							</thead>
							<tbody>
								{closeMatches.map((match, idx) => (
									<tr key={idx}>
										<td>{match.name1}</td>
										<td>{match.name2}</td>
										<td>{(match.difference * 100).toFixed(4)}%</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
};

// Main component
const HarmonicFrequencyExplorer = () => {
	const [baseFrequency, setBaseFrequency] = useState(440);
	const [recursionLevel, setRecursionLevel] = useState(2);
	const [nHarmonics, setNHarmonics] = useState(12);
	const [mode, setMode] = useState("harmonic");
	const [customRatios, setCustomRatios] = useState([1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75]);
	const [customRatiosInput, setCustomRatiosInput] = useState("1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75");
	const [threshold, setThreshold] = useState(0.01);
	const [maxDenominator, setMaxDenominator] = useState(12);
	const [harmonicStructure, setHarmonicStructure] = useState(null);
	const [closePairs, setClosePairs] = useState([]);
	const [ratios, setRatios] = useState([]);
	const [loading, setLoading] = useState(false);
	const [currentTab, setCurrentTab] = useState('tree');
	const [treeData, setTreeData] = useState(null);

	useEffect(() => {
		calculateResults();
		// Initialize improved tree data
		setTreeData(createFrequencyTree(
			parseFloat(baseFrequency), 
			recursionLevel, 
			nHarmonics, 
			mode,
			mode === "custom" ? customRatios : null
		));
	}, [baseFrequency, recursionLevel, nHarmonics, mode, threshold, maxDenominator, customRatios]);

	// Handle custom ratios input parsing
	const handleCustomRatiosChange = (value) => {
		setCustomRatiosInput(value);
		try {
			const ratios = value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0);
			if (ratios.length >= 2 && ratios.length <= 20) {
				setCustomRatios(ratios);
			}
		} catch (e) {
			// Invalid input, keep previous ratios
		}
	};

	const calculateResults = () => {
		setLoading(true);
		try {
			const structure = generateHarmonicStructure(
				parseFloat(baseFrequency), 
				recursionLevel, 
				nHarmonics, 
				mode,
				mode === "custom" ? customRatios : null
			);
			const pairs = findCloseFrequencies(structure, threshold);
			const ratioAnalysis = analyzeFrequencyRatios(structure, maxDenominator);
			
			setHarmonicStructure(structure);
			setClosePairs(pairs);
			setRatios(ratioAnalysis);
		} catch (error) {
			console.error("Error calculating results:", error);
		} finally {
			setLoading(false);
		}
	};

	// Format frequencies for distribution chart (placeholder for now)
	const getFrequencyDistribution = () => {
		if (!harmonicStructure) return [];
		
		const allFreqs = flattenFrequencies(harmonicStructure);
		const bins = {};
		const binSize = 50;
		const maxFreq = Math.max(...allFreqs);
		
		for (let i = 0; i < maxFreq; i += binSize) {
			bins[i] = 0;
		}
		
		allFreqs.forEach(freq => {
			const binIndex = Math.floor(freq / binSize) * binSize;
			bins[binIndex] = (bins[binIndex] || 0) + 1;
		});
		
		return Object.entries(bins).map(([bin, count]) => ({
			bin: parseFloat(bin),
			count
		})).filter(item => item.count > 0);
	};

	const distributionData = getFrequencyDistribution();

	// Format close pairs for display with path information
	const closePairsData = closePairs
		.filter(pair => pair && typeof pair.freq1 === 'number' && typeof pair.freq2 === 'number')
		.sort((a, b) => a.difference - b.difference)
		.map(pair => ({
			freqA: pair.freq1.toFixed(2),
			freqB: pair.freq2.toFixed(2),
			pathA: pair.path1 || 'Unknown',
			pathB: pair.path2 || 'Unknown',
			difference: pair.difference.toFixed(6),
			percentDiff: (pair.difference * 100).toFixed(4) + '%'
		}));

	// Format ratios for display with path information
	const ratiosData = ratios
		.filter(ratio => ratio && typeof ratio.freq1 === 'number' && typeof ratio.freq2 === 'number')
		.sort((a, b) => a.difference - b.difference)
		.map(ratio => ({
			freqA: ratio.freq1.toFixed(2),
			freqB: ratio.freq2.toFixed(2),
			pathA: ratio.path1 || 'Unknown',
			pathB: ratio.path2 || 'Unknown',
			actualRatio: ratio.actualRatio.toFixed(6),
			simpleRatio: `${ratio.simpleRatio[0]}/${ratio.simpleRatio[1]} (${(ratio.simpleRatio[0]/ratio.simpleRatio[1]).toFixed(6)})`,
			difference: ratio.difference.toFixed(8)
		}));

	return (
		<div className="app" style={appStyles}>
			<h1 className="app-title">Hypokei Explorer</h1>
			
			{/* About Section */}
			<div className="window about-window">
				<h2 className="section-title">The Hypokei Function</h2>
				<p>This tool explores recursive harmonic relationships in frequency space, allowing you to:</p>
				<ul>
					<li>Generate frequency sets using harmonic series, Just Intonation ratios, 12-tone equal temperament, or custom ratios</li>
					<li>Apply recursive transformations to explore complex harmonic structures</li>
					<li>Explore the convergence of acoustic physics and musical harmony</li>
					<li>Visualize hierarchical relationships between frequencies</li>
					<li>Use a custom sequence of numbers and explore the relationships between iterations of the set (for example, the Fibonacci Sequence)</li>
				</ul>
				<p>
				Everything has a fundamental frequency, and with that frequency comes a set of harmonics which has a relationship with every other tone that could exist. This is also true for musical scales.
				This tool helps to visualize these connections.
				</p>
				<p>	
				For an immediate idea of what it is doing, check the "Just Intonation" setting and then "12-tone Equal Temperament" (the modern music scale) in Log Scale. Note how the method of generating a scale
				have very different structures.
				</p>
				<p>The notation H^n(f) represents n recursive applications of the harmonic function to the base frequency f. See the paper for more details.</p>
				<p><strong>Tree View:</strong> Each frequency node can be expanded to show its harmonic children. Colors represent different recursion levels (H^0, H^1, etc.). Click any frequency to explore its recursive harmonic structure. Capped at 3 levels.</p>
				<p><strong>Side View:</strong> Shows all generated frequencies plotted on a linear or logarithmic scale, color-coded by recursion level.</p>
			</div>
			
			{/* Header Section */}
			<div className="window header-window">
				<h2 className="section-title">Parameters</h2>
				<div className="parameters-grid">
					<div className="param-group">
						<label>Base Frequency (Hz)</label>
						<input
							type="number"
							value={baseFrequency}
							onChange={(e) => setBaseFrequency(e.target.value)}
							min="1"
						/>
					</div>
					
					<div className="param-group">
						<label>Recursion Level (H^n)</label>
						<input
							type="number"
							value={recursionLevel}
							onChange={(e) => setRecursionLevel(parseInt(e.target.value))}
							min="0"
							max="3"
						/>
					</div>
					
					<div className="param-group">
						<label>Harmonics/Notes per Level</label>
						<input
							type="number"
							value={nHarmonics}
							onChange={(e) => setNHarmonics(parseInt(e.target.value))}
							min="3"
							max="13"
						/>
					</div>
					
					<div className="param-group">
						<label>Mode</label>
						<select
							value={mode}
							onChange={(e) => setMode(e.target.value)}
						>
							<option value="harmonic">Harmonic Series</option>
							<option value="just">Just Intonation</option>
							<option value="equal">12-Tone Equal Temperament</option>
							<option value="custom">Custom Ratios</option>
						</select>
					</div>
					
					{mode === "custom" && (
						<div className="param-group custom-ratios">
							<label>Custom Ratios (2-20 values)</label>
							<input
								type="text"
								value={customRatiosInput}
								onChange={(e) => handleCustomRatiosChange(e.target.value)}
								placeholder="1, 1.25, 1.5, 1.75, 2"
								style={{ fontSize: '0.8rem' }}
							/>
							<small style={{ color: '#ccc', fontSize: '0.75rem' }}>
								Enter comma-separated values.
							</small>
						</div>
					)}
					
					<div className="param-group">
						<label>Closeness Threshold</label>
						<input
							type="number"
							value={threshold}
							onChange={(e) => setThreshold(parseFloat(e.target.value))}
							step="0.001"
							min="0.0001"
							max="0.1"
						/>
					</div>
					
					<div className="param-group">
						<label>Max Denominator for Ratios</label>
						<input
							type="number"
							value={maxDenominator}
							onChange={(e) => setMaxDenominator(parseInt(e.target.value))}
							min="2"
							max="24"
						/>
					</div>
				</div>
				
				<div className="status-info">
					<p>Current configuration: H^{recursionLevel}({baseFrequency}) with {nHarmonics} {mode === "harmonic" ? "harmonics" : mode === "custom" ? "custom ratios" : "notes"} per level</p>
					<p>Generated {harmonicStructure ? flattenFrequencies(harmonicStructure).length : 0} frequencies with {closePairs.length} close pairs</p>
					{mode === "custom" && (
						<p>Custom ratios: [{customRatios.map(r => r.toFixed(3)).join(', ')}]</p>
					)}
				</div>
			</div>
			
			{/* Main Content Section */}
			<div className="window main-window">
				<div className="tabs">
					<button 
						className={`tab ${currentTab === 'tree' ? 'active' : ''}`}
						onClick={() => setCurrentTab('tree')}
					>
						Hierarchical Tree
					</button>
					<button 
						className={`tab ${currentTab === 'sideView' ? 'active' : ''}`}
						onClick={() => setCurrentTab('sideView')}
					>
						Side View
					</button>
					<button 
						className={`tab ${currentTab === 'phaseSpace' ? 'active' : ''}`}
						onClick={() => setCurrentTab('phaseSpace')}
					>
						Phase Space
					</button>
					<button 
						className={`tab ${currentTab === 'frequencies' ? 'active' : ''}`}
						onClick={() => setCurrentTab('frequencies')}
					>
						Frequency Distribution
					</button>
					<button 
						className={`tab ${currentTab === 'closePairs' ? 'active' : ''}`}
						onClick={() => setCurrentTab('closePairs')}
					>
						Close Pairs
					</button>
					<button 
						className={`tab ${currentTab === 'ratios' ? 'active' : ''}`}
						onClick={() => setCurrentTab('ratios')}
					>
						Simple Ratios
					</button>
				</div>
				
				{loading ? (
					<div className="loading">Loading calculations...</div>
				) : (
					<div className="content">
						{currentTab === 'tree' && treeData && (
							<HierarchicalTree 
								data={treeData} 
								baseFreq={parseFloat(baseFrequency)}
								nHarmonics={nHarmonics}
								mode={mode}
								threshold={threshold}
								maxLevel={recursionLevel}
								customRatios={mode === "custom" ? customRatios : null}
							/>
						)}
						
						{currentTab === 'sideView' && (
							<SideView 
								structure={harmonicStructure}
								baseFreq={parseFloat(baseFrequency)}
								nHarmonics={nHarmonics}
								mode={mode}
							/>
						)}
						
						{currentTab === 'phaseSpace' && (
							<PhaseSpaceView 
								structure={harmonicStructure}
								baseFreq={parseFloat(baseFrequency)}
								nHarmonics={nHarmonics}
								mode={mode}
							/>
						)}

						{currentTab === 'frequencies' && (
							<div className="frequencies-content">
								<h2 className="content-title">Frequency Distribution</h2>
								<div className="chart-container">
									<ResponsiveContainer width="100%" height="100%">
										<BarChart data={distributionData}>
											<CartesianGrid strokeDasharray="3 3" />
											<XAxis dataKey="bin" label={{ value: 'Frequency Bin (Hz)', position: 'bottom' }} />
											<YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
											<Tooltip formatter={(value, name, props) => [`${value} frequencies`, `${props.payload.bin} - ${props.payload.bin + 50} Hz`]} />
											<Bar dataKey="count" fill="#8884d8" />
										</BarChart>
									</ResponsiveContainer>
								</div>
								
								<div className="table-container scrollable-table">
									<table className="data-table">
										<thead>
											<tr>
												<th>Index</th>
												<th>Frequency (Hz)</th>
											</tr>
										</thead>
										<tbody>
											{harmonicStructure && flattenFrequencies(harmonicStructure).map((freq, idx) => (
												<tr key={idx}>
													<td>{idx}</td>
													<td>{freq.toFixed(2)}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						)}
						
						{currentTab === 'closePairs' && (
							<div className="pairs-content">
								<h2 className="content-title">Close Frequency Pairs</h2>
								<p className="content-description">
									Showing frequency pairs that differ by less than {(threshold * 100).toFixed(2)}%
								</p>
								
								<div className="table-container scrollable-table">
									<table className="data-table">
										<thead>
											<tr>
												<th>Frequency A (Hz)</th>
												<th>Path A</th>
												<th>Frequency B (Hz)</th>
												<th>Path B</th>
												<th>Relative Difference</th>
												<th>Percent Difference</th>
											</tr>
										</thead>
										<tbody>
											{closePairsData.map((pair, idx) => (
												<tr key={idx}>
													<td>{pair.freqA}</td>
													<td className="path-cell">{pair.pathA}</td>
													<td>{pair.freqB}</td>
													<td className="path-cell">{pair.pathB}</td>
													<td>{pair.difference}</td>
													<td>{pair.percentDiff}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						)}
						
						{currentTab === 'ratios' && (
							<div className="ratios-content">
								<h2 className="content-title">Simple Ratio Approximations</h2>
								<p className="content-description">
									Finding the closest simple integer ratios for each frequency pair
								</p>
								
								<div className="table-container scrollable-table">
									<table className="data-table">
										<thead>
											<tr>
												<th>Frequency A (Hz)</th>
												<th>Path A</th>
												<th>Frequency B (Hz)</th>
												<th>Path B</th>
												<th>Actual Ratio</th>
												<th>Closest Simple Ratio</th>
												<th>Difference</th>
											</tr>
										</thead>
										<tbody>
											{ratiosData.map((ratio, idx) => (
												<tr key={idx}>
													<td>{ratio.freqA}</td>
													<td className="path-cell">{ratio.pathA}</td>
													<td>{ratio.freqB}</td>
													<td className="path-cell">{ratio.pathB}</td>
													<td>{ratio.actualRatio}</td>
													<td>{ratio.simpleRatio}</td>
													<td>{ratio.difference}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

// Inline styles
const appStyles = {
	maxWidth: '1200px',
	margin: '0 auto',
	padding: '20px',
	fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
	lineHeight: '1.6',
	color: '#333'
};

export default HarmonicFrequencyExplorer;
