import { Plane, useTexture, shaderMaterial } from "@react-three/drei";
import { useThree, extend, ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { useGameStore } from "../../store";
import { TileProps } from "../../types";

interface TileShaderMaterialProps {
  uTexture1: THREE.Texture | null;
  uTexture2: THREE.Texture | null;
  uMixRatio: number;
}

const TileShaderMaterial = shaderMaterial(
  { uTexture1: null, uTexture2: null, uMixRatio: 0.5 },
  `varying vec2 vUv;
   void main() {
     vUv = uv;
     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
   }`,
  `uniform sampler2D uTexture1;
   uniform sampler2D uTexture2;
   uniform float uMixRatio;
   varying vec2 vUv;
   void main() {
     vec4 color1 = texture2D(uTexture1, vUv);
     vec4 color2 = texture2D(uTexture2, vUv);
     gl_FragColor = mix(color1, color2, uMixRatio);
   }`
);

extend({ TileShaderMaterial });

declare global {
  namespace JSX {
    interface IntrinsicElements {
      tileShaderMaterial: TileShaderMaterialProps & JSX.IntrinsicElements["shaderMaterial"];
    }
  }
}

interface TileControls extends THREE.EventDispatcher {
  fitToBox: (box: THREE.Object3D, focus?: boolean, options?: any) => void;
  truckSpeed: number;
}

const Tile = ({ position, startNode, finishNode, rest }: TileProps) => {
  const texture1 = useTexture("textures/grass.jpg");
  const texture2 = useTexture("textures/grass-1.jpg");
  const texture3 = useTexture("textures/ground-3.jpg");
  const midTileRef = useRef<THREE.Mesh>(null);
  const tileRef = useRef<THREE.Mesh>(null);
  const controls = useThree((s) => s.controls) as unknown as TileControls;
  const addClickableObjs = useGameStore((s) => s.addClickableObjs);

  // Function to reset the camera
  const resetCamera = () => {
    if (!midTileRef.current || !controls) return;

    controls.fitToBox(midTileRef.current, false, {
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 6,
      paddingBottom: 5,
    });
    controls.truckSpeed = 0;
    addClickableObjs(midTileRef.current);
  };

  useEffect(() => {
    resetCamera();
  }, [midTileRef.current, controls]);

  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const mixRatio = useMemo(() => Math.random(), []);

  useEffect(() => {
    if (tileRef.current) {
      addClickableObjs(tileRef.current);
    }
  }, [tileRef.current]);

  return (
    <Plane
      ref={position[0] === 5 && position[1] === 5 ? midTileRef : tileRef}
      args={[1, 1]}
      position={position}
      receiveShadow
      name={`plane-${position[0]}-${position[1]}`}
      userData={rest}
    >
      <tileShaderMaterial
        ref={materialRef}
        uTexture1={startNode || finishNode ? texture3 : texture1}
        uTexture2={texture2}
        uMixRatio={startNode || finishNode ? 0.5 : mixRatio}
        side={THREE.DoubleSide}
      />
    </Plane>
  );
};

export default Tile;
