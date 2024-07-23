import { Plane, useTexture, shaderMaterial } from "@react-three/drei";
import { useThree, extend } from "@react-three/fiber";
import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";

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

// eslint-disable-next-line react/prop-types
const Tile = ({ position, startNode, finishNode }) => {
  const texture1 = useTexture("textures/grass.jpg");
  const texture2 = useTexture("textures/grass-1.jpg");
  const texture3 = useTexture("textures/ground-3.jpg");
  const tileRef = useRef();
  const controls = useThree((s) => s.controls);
  const scene = useThree((s) => s.scene);

  // Function to reset the camera
  const resetCamera = () => {
    if (!tileRef.current || !controls) return;

    controls.fitToBox(tileRef.current, false, {
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 6,
      paddingBottom: 5,
    });
    console.log(scene);
  };

  useEffect(() => {
    resetCamera();
  }, [tileRef.current, controls]);

  const materialRef = useRef();
  const mixRatio = useMemo(() => Math.random(), []);

  //   useFrame(() => {
  //     if (materialRef.current) {
  //       materialRef.current.uniforms.uMixRatio.value = mixRatio;
  //     }
  //   });

  return (
    <Plane
      ref={position[0] === 5 && position[1] === 5 ? tileRef : null}
      args={[1, 1]}
      position={position}
      receiveShadow
      name={`plane-${position[0]}-${position[1]}`}
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
