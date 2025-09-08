class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    rotateX(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const y = this.y;
        const z = this.z;
        this.y = y*cos - z*sin;
        this.z = y*sin + z*cos;
    }

    rotateY(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = this.x;
        const z = this.z;
        this.x = x*cos + z*sin;
        this.z = z*cos - x*sin;
    }

    rotateZ(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = this.x;
        const y = this.y;
        this.x = x*cos - y*sin;
        this.y = y*cos + x*sin;
    }

    copy() {
        return new Vector3(this.x, this.y, this.z);
    }
}

class Material {
    constructor() {
        this.baseColor = [0, 255, 65];
        this.metallic = 0.0;
        this.roughness = 0.5;
        this.visible = true;
    }
}

class Object3D {
    constructor() {
        this.vertices = [];
        this.faces = [];
        this.position = {x:0, y:0, z:0};
        this.rotation = {x:0, y:0, z:0};
        this.scale = {x:1, y:1, z:1};
        this.material = new Material();
        this.visible = true;
    }

    addVertex(x, y, z) {
        this.vertices.push(new Vector3(x, y, z));
    }

    addFace(indices) {
        this.faces.push(indices);
    }

    getTransformedVertices() {
        return this.vertices.map(vertex => {
            let v = vertex.copy();

            v.x *= this.scale.x;
            v.y *= this.scale.y;
            v.z *= this.scale.z;

            v.rotateX(this.rotation.x);
            v.rotateY(this.rotation.y);
            v.rotateZ(this.rotation.z);

            v.x += this.position.x;
            v.y += this.position.y;
            v.z += this.position.z;

            return v;
        });
    }

    rotate(rx, ry, rz) {
        this.rotation.x += rx;
        this.rotation.y += ry;
        this.rotation.z += rz;
    }

    calculateFaceNormal(face, transformedVertices) {
        if(face.length < 3) return {x:0, y:0, z:1};

        const v1 = transformedVertices[face[0]];
        const v2 = transformedVertices[face[1]];
        const v3 = transformedVertices[face[2]];

        const edge1 = {
            x: v2.x - v1.x,
            y: v2.y - v1.y,
            z: v2.z - v1.z
        };

        const edge2 = {
            x: v3.x - v1.x,
            y: v3.y - v1.y,
            z: v3.z - v1.z
        };

        const normal = {
            x: edge1.y * edge2.z - edge1.z * edge2.y,
            y: edge1.z * edge2.x - edge1.x * edge2.z,
            z: edge1.x * edge2.y - edge1.y * edge2.x
        };

        const length = Math.sqrt(normal.x**2 + normal.y**2 + normal.z**2);
        if(length > 0){
            normal.x /= length;
            normal.y /= length;
            normal.z /= length;
        };

        return normal;
    }

    resetRotation() {
        this.rotation = {x:0, y:0, z:0};
    }
}

class Cube extends Object3D {
    constructor(size = 1) {
        super();
        const s = size / 2;

        this.addVertex(-s, -s, -s); // 0
        this.addVertex( s, -s, -s); // 1
        this.addVertex( s,  s, -s); // 2
        this.addVertex(-s,  s, -s); // 3
        this.addVertex(-s, -s,  s); // 4
        this.addVertex( s, -s,  s); // 5
        this.addVertex( s,  s,  s); // 6
        this.addVertex(-s,  s,  s); // 7

        this.addFace([0, 1, 2, 3]); // front
        this.addFace([5, 4, 7, 6]); // back
        this.addFace([4, 0, 3, 7]); // left
        this.addFace([1, 5, 6, 2]); // right
        this.addFace([3, 2, 6, 7]); // top
        this.addFace([4, 5, 1, 0]); // bottom

    }
}

class Renderer {
    constructor(canvas){
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        this.camera = {
            fov: 60,
            distance: 6,
            centerX: this.width / 2,
            centerY: this.height / 2
        };

        this.lightDirection = {x: 0.3, y: -0.5, z: -1};
        this.ambientLight = 0.3;
        this.viewportMode = 'SOLID';
        this.showWireframe = false;
        this.backfaceCulling = true;

        this.wireframeColor = '#4DE4CDFF';
        this.solidColor = '#808080';
        this.backgroundColor = '#1a1a1a';
    };

    setViewportMode(mode){
        this.viewportMode = mode.toUpperCase();
        console.log(`Viewport mode set to: ${this.viewportMode}`);
    };

    toggleWireframe(){
        this.showWireframe = !this.showWireframe;
        console.log(`Wireframe mode: ${this.showWireframe ? 'ON' : 'OFF'}`);
    };

    toggleBackfaceCulling(){
        this.backfaceCulling = !this.backfaceCulling;
        console.log(`Backface culling: ${this.backfaceCulling ? 'ON' : 'OFF'}`);
    }

    project(vertex) {
        const focalLength = this.width/(2*Math.tan((this.camera.fov*Math.PI/180)/2));

        const scale = focalLength/(vertex.z + this.camera.distance);

        return {
            x: vertex.x*scale + this.camera.centerX,
            y: -vertex.y*scale + this.camera.centerY,
            z: vertex.z
        };
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawWireframe(object, color = "#0000ff") {
        const transformedVertices = object.getTransformedVertices();
        const projectedVertices = transformedVertices.map(v => this.project(v));

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;

        object.faces.forEach(face => {
            if(face.length === 2) {
                const p1 = projectedVertices[face[0]];
                const p2 = projectedVertices[face[1]];

                this.ctx.beginPath();
                this.ctx.moveTo(p1.x, p1.y);
                this.ctx.lineTo(p2.x, p2.y);
                this.ctx.stroke();
            }
            else{
                this.ctx.beginPath();
                const firstVertex = projectedVertices[face[0]];
                this.ctx.moveTo(firstVertex.x, firstVertex.y);

                for(let i=1; i<face.length; i++){
                    const vertex = projectedVertices[face[i]];
                    this.ctx.lineTo(vertex.x, vertex.y);
                }
                this.ctx.closePath();
                this.ctx.stroke();
            }
        });

        this.ctx.fillStyle = color;
        projectedVertices.forEach(v => {
            this.ctx.beginPath();
            this.ctx.arc(v.x, v.y, 3, 0, 2*Math.PI);
            this.ctx.fill();
        });
    }

    drawSolid(object){
        const transformedVertices = object.getTransformedVertices();
        const projectedVertices = transformedVertices.map(v => this.project(v));

        const faceWithDepth = object.faces.map((face, index) => {
            let avgZ = 0;
            face.forEach(idx => {
                avgZ += transformedVertices[idx].z;
            });
            avgZ /= face.length;

            const normal = object.calculateFaceNormal(face, transformedVertices);

            return {
                face: face,
                depth: avgZ,
                normal: normal,
                index: index
            };
        });

        faceWithDepth.sort((a, b) => b.depth - a.depth);

        faceWithDepth.forEach(faceData => {
            const { face, normal } = faceData;

            if (face.length < 3) return;

            if(this.backfaceCulling) {
                const dot = normal.z;
                if(dot <= 0) return;
            }

            this.ctx.fillStyle = this.solidColor
            this.ctx.beginPath();

            const firstVertex = projectedVertices[face[0]];
            this.ctx.moveTo(firstVertex.x, firstVertex.y);

            for(let i=1; i<face.length; i++){
                const vertex = projectedVertices[face[i]];
                this.ctx.lineTo(vertex.x, vertex.y);
            }

            this.ctx.closePath();
            this.ctx.fill();

            this.ctx.strokeStyle = 'rgba(0, 255, 65, 0.3)';
        });
    };

    drawMaterial(object) {
        const transformedVertices = object.getTransformedVertices();
        const projectedVertices = transformedVertices.map( v => this.project(v));

        const faceWithDepth = object.faces.map((face, index) => {
            let avgZ = 0;
            face.forEach(idx => {
                avgZ += transformedVertices[idx].z;
            });
            avgZ /= face.length;

            const normal = object.calculateFaceNormal(face, transformedVertices);
            return {
                face, depth: avgZ, normal, index
            };
        });

        faceWithDepth.sort((a, b) => b.depth - a.depth);

        faceWithDepth.forEach(faceData => {
            const { face, normal } = faceData;
            if(face.length < 3) return;

            if(this.backfaceCulling){
                const dot = normal.z;
                if(dot <= 0) return;
            }

            const lightIntensity = Math.max(0, -(
                normal.x * this.lightDirection.x + normal.y * this.lightDirection.y + normal.z * this.lightDirection.z
            ));

            const material = object.material;
            const finalIntensity = this.ambientLight + (1 - this.ambientLight) * lightIntensity;

            const shadedColor = {
                r: Math.floor(material.baseColor[0] * finalIntensity),
                g: Math.floor(material.baseColor[1] * finalIntensity),
                b: Math.floor(material.baseColor[2] * finalIntensity)
            };

            this.ctx.fillStyle = `rgb(${shadedColor.r}, ${shadedColor.g}, ${shadedColor.b})`;
            this.ctx.beginPath();

            const firstVertex = projectedVertices[face];
            this.ctx.moveTo(firstVertex.x, firstVertex.y);

            for(let i=1; i<face.length; i++){
                const vertex = projectedVertices[face[i]];
                this.ctx.lineTo(vertex.x, vertex.y);
            }
            this.ctx.closePath();
            this.ctx.fill();
        })
    };

    drawRendered(object) {
        this.drawMaterial(object);

        const transformedVertices = object.getTransformedVertices();
        const projectedVertices = transformedVertices.map(v => this.project(v));

        this.ctx.shadowColor = 'rgba(0, 255, 65, 0.3)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    }

    render(objects) {
        this.clear();
        objects.forEach(obj => {
            if(!obj.visible) return;

            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;

            switch(this.viewportMode) {
                case 'WIREFRAME':
                    this.drawWireframe(obj);
                    break;
                case 'SOLID':
                    this.drawSolid(obj);
                    if(this.showWireframe) {
                        this.drawWireframe(obj, 'rgba(0, 255, 65, 0.4');
                    }
                    break;
                case 'MATERIAL':
                    this.drawMaterial(obj);
                    if(this.showWireframe){
                        this.drawWireframe(obj, 'rgba(0, 255, 65, 0.4');
                    }
                    break;
                case 'RENDERED':
                    this.drawRendered(obj);
                    if(this.showWireframe){
                        this.drawWireframe(obj, 'rgba(0, 255, 65, 0.4');
                    }
                    break;
                default:
                    this.drawSolid(obj);
                    break;
            }
        });
    }
}

class AnimationLoop {
    constructor(renderer, objects) {
        this.renderer = renderer;
        this.objects = objects;
        this.isRunning = false;
    }

    start() {
        this.isRunning = true;
        this.loop();
    }

    stop() {
        this.isRunning = false;
    }

    loop() {
        if(!this.isRunning) return;

        this.renderer.render(this.objects);
        requestAnimationFrame(() => this.loop());
    }
}