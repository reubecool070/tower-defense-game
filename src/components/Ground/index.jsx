/* eslint-disable react/prop-types */
import { OrbitControls, Plane, Stats } from "@react-three/drei";
import { Color } from "three";
import { useThree } from "@react-three/fiber";

const Ground = () => {
  const camera = useThree((s) => s.camera);

  const Tile = ({ position, color }) => {
    return (
      <Plane args={[1, 1]} position={position} receiveShadow>
        <meshStandardMaterial color={color} />
      </Plane>
    );
  };

  const tiles = [];
  const rows = 10;
  const cols = 10;
  for (let x = 0; x < rows; x++) {
    for (let y = 0; y < cols; y++) {
      const color = new Color(Math.random(), Math.random(), Math.random());
      tiles.push({
        startNode: 0,
        finishNode: 0,
        row: x,
        col: y,
        color: color,
      });
    }
  }

  const centerX = rows / 2;
  const centerY = cols / 2;
  const distance = Math.max(rows, cols);
  console.log(centerX, centerY, distance);
  console.log(camera);
  camera.addEventListener("update", () => {
    console.log("updating");
  });
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <OrbitControls
        enableZoom={true}
        // enableRotate={false}
        // minAzimuthAngle={Math.PI / 2}
        // enablePan={false} // Disable panning
      />
      {tiles.map(({ row, col, color }) => (
        <Tile key={`${row}-${col}`} position={[row, col, 0]} color={color} />
      ))}
      <Stats />
    </>
  );
};

export default Ground;
