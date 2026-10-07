/**
 * components/minisite/Ornament.js — ornements dessinés (SVG, légers, sans image)
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export default function Ornament({ kind, color, width = 220, opacity = 0.55, style }) {
  if (!kind || kind === 'none') return null;
  const h = 28;
  const mid = width / 2;
  let body = null;
  switch (kind) {
    case 'lines':
      body = (<>
        <Line x1={0} y1={h / 2} x2={mid - 14} y2={h / 2} stroke={color} strokeWidth={1} />
        <Rect x={mid - 5} y={h / 2 - 5} width={10} height={10} transform={`rotate(45 ${mid} ${h / 2})`} fill="none" stroke={color} />
        <Line x1={mid + 14} y1={h / 2} x2={width} y2={h / 2} stroke={color} strokeWidth={1} />
      </>);
      break;
    case 'dots':
      body = Array.from({ length: 9 }, (_, i) => <Circle key={i} cx={mid + (i - 4) * 14} cy={h / 2} r={i === 4 ? 4 : 2.2} fill={color} />);
      break;
    case 'stars':
      body = [-1, 0, 1].map((i) => (
        <Path key={i} fill={color} transform={`translate(${mid + i * 26 - 8} ${h / 2 - 8}) scale(${i ? 0.7 : 1})`}
          d="M8 0l2.2 5.3L16 6l-4.4 3.8L13 16 8 12.8 3 16l1.4-6.2L0 6l5.8-.7z" />
      ));
      break;
    case 'waves':
      body = <Path d={`M0 ${h / 2} ${Array.from({ length: 8 }, (_, i) => `Q ${(i + 0.5) * width / 8} ${i % 2 ? h - 4 : 4} ${(i + 1) * width / 8} ${h / 2}`).join(' ')}`}
        stroke={color} strokeWidth={1.6} fill="none" />;
      break;
    case 'botanical':
      body = (<>
        <Path d={`M${mid - 70} ${h / 2} C ${mid - 40} ${h / 2 - 12}, ${mid - 20} ${h / 2 + 10}, ${mid} ${h / 2}`} stroke={color} fill="none" />
        <Path d={`M${mid + 70} ${h / 2} C ${mid + 40} ${h / 2 - 12}, ${mid + 20} ${h / 2 + 10}, ${mid} ${h / 2}`} stroke={color} fill="none" />
        {[-50, -30, 30, 50].map((x) => <Path key={x} fill={color}
          d={`M${mid + x} ${h / 2 - 2} q 6 -10 12 -6 q -4 8 -12 6z`} />)}
        <Circle cx={mid} cy={h / 2} r={3.5} fill={color} />
      </>);
      break;
    case 'confetti':
      body = [[-90, 6, 20], [-60, 18, -30], [-28, 4, 50], [0, 14, 10], [30, 6, -40], [62, 18, 25], [92, 8, -15]].map(([x, y, r], i) => (
        <Rect key={i} x={mid + x} y={y} width={8} height={4} rx={1.5} fill={color} transform={`rotate(${r} ${mid + x + 4} ${y + 2})`} />
      ));
      break;
    case 'arches':
      body = [-1, 0, 1].map((i) => (
        <Path key={i} d={`M${mid + i * 34 - 12} ${h} v -10 a 12 12 0 0 1 24 0 v 10`} stroke={color} fill="none" strokeWidth={1.2} />
      ));
      break;
    case 'grain':
      body = Array.from({ length: 24 }, (_, i) => <Circle key={i} cx={(i * 37) % width} cy={(i * 13) % h} r={1} fill={color} />);
      break;
    default:
      return null;
  }
  return (
    <View style={[{ alignItems: 'center', opacity }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={h}>{body}</Svg>
    </View>
  );
}
