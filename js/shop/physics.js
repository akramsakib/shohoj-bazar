/* Physics — a real rigid-body world instead of hand-animated positions.

   Before this file existed:
     * the trolley was a group whose position was lerped toward a point in front
       of the camera, so it slid through shelves, people and the checkout counter;
     * a pack you put in the trolley was teleported to a stacked slot and stayed
       there, hanging in space, whatever happened around it;
     * nothing could fall, settle, or be knocked over. That is why the shop felt
       like a diorama rather than a place.

   Now:
     * the aisle, shelving, counters, pallets and walls are static boxes;
     * the trolley is a dynamic body with a compound basket (floor + four walls),
       dragged by a spring from the shopper's hands, so it swings, bumps and stops
       against the counter instead of passing through it;
     * every pack put in the trolley is a rigid body that *falls* into the basket,
       collides with the other packs and settles where gravity and friction put it;
     * anything you let go of drops to the floor and comes to rest.

   Stepped at a fixed 1/60 s with an accumulator, so behaviour does not change
   with frame rate. Bodies sleep, so a full trolley costs almost nothing.
*/

import * as CANNON from '../../vendor/cannon/cannon-es.js';
import * as THREE from '../../vendor/three.module.js';

export class ShopPhysics {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.solver.iterations = 7;
    this.world.solver.tolerance = 0.005;

    // surfaces: polished tile is slippery, rubber wheels grip
    this.mats = {
      tile: new CANNON.Material('tile'),
      steel: new CANNON.Material('steel'),
      pack: new CANNON.Material('pack'),
    };
    const c = (a, b, friction, restitution) =>
      this.world.addContactMaterial(new CANNON.ContactMaterial(a, b, { friction, restitution }));
    c(this.mats.tile, this.mats.steel, 0.35, 0.02);
    c(this.mats.tile, this.mats.pack, 0.55, 0.05);
    c(this.mats.pack, this.mats.pack, 0.42, 0.02);
    c(this.mats.pack, this.mats.steel, 0.40, 0.05);
    c(this.mats.steel, this.mats.steel, 0.3, 0.02);

    this.accumulator = 0;
    this.step = 1 / 60;
    this.packs = [];              // { body, mesh }

    // the floor
    const floor = new CANNON.Body({ mass: 0, material: this.mats.tile });
    floor.addShape(new CANNON.Plane());
    floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(floor);

    this.trolley = null;
    this.player = null;
  }

  /* ---------------------------------------------------------- static world */
  addBox(halfExtents, position, quaternion, material) {
    const body = new CANNON.Body({
      mass: 0,
      material: material || this.mats.tile,
      shape: new CANNON.Box(new CANNON.Vec3(halfExtents.x, halfExtents.y, halfExtents.z)),
      position: new CANNON.Vec3(position.x, position.y, position.z),
    });
    if (quaternion) body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    this.world.addBody(body);
    this.statics = this.statics || [];
    this.statics.push({
      minX: position.x - halfExtents.x, maxX: position.x + halfExtents.x,
      minZ: position.z - halfExtents.z, maxZ: position.z + halfExtents.z,
      top: position.y + halfExtents.y,
    });
    return body;
  }

  /** Push a point out of every static box it is standing in (circle vs AABB).
      This is what stops the shopper walking through shelving and the counter. */
  resolveCircle(pos, radius, height) {
    const list = this.statics || [];
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (height !== undefined && b.top <= 0.12) continue;      // floor decals, belts
      const x = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const z = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - x, dz = pos.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > radius * radius) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = x + (dx / d) * radius;
        pos.z = z + (dz / d) * radius;
      } else {
        // dead centre: pick the smallest push out of the box
        const pushes = [
          [b.minX - radius - pos.x, 'x'], [b.maxX + radius - pos.x, 'x'],
          [b.minZ - radius - pos.z, 'z'], [b.maxZ + radius - pos.z, 'z'],
        ].sort((a, bb) => Math.abs(a[0]) - Math.abs(bb[0]));
        if (pushes[0][1] === 'x') pos.x += pushes[0][0];
        else pos.z += pushes[0][0];
      }
    }
    return pos;
  }

  /* A capsule stand-in for the shopper: a body we drive by velocity, so collisions
     push it out of shelves instead of the camera passing through them. */
  addPlayer(position) {
    const body = new CANNON.Body({
      mass: 74,
      material: this.mats.steel,
      shape: new CANNON.Sphere(0.34),
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: 0.86,
      fixedRotation: true,
    });
    body.updateMassProperties();
    body.type = CANNON.Body.KINEMATIC;    // we author the motion, physics just blocks it
    this.world.addBody(body);
    this.player = body;
    return body;
  }

  /* ------------------------------------------------------------- trolley */
  /**
   * @param {THREE.Object3D} object3d  the loaded trolley model
   * @param {object} dims  { halfW, halfL, floorY, rimY, handleOffset }
   */
  attachTrolley(object3d, dims) {
    const body = new CANNON.Body({
      mass: 14,
      material: this.mats.steel,
      linearDamping: 0.22,
      angularDamping: 0.9,
    });
    body.position.set(object3d.position.x, 0.55, object3d.position.z);
    // the chassis is only the wheelbase. It used to be a full-height box, which
    // sealed the basket: packs spawned inside solid geometry and were fired out.
    body.addShape(new CANNON.Box(new CANNON.Vec3(dims.halfW, 0.11, dims.halfL)),
      new CANNON.Vec3(0, -0.43, 0));
    // the basket itself: floor + four walls, so packs land inside and stack
    const t = 0.02, h = dims.rimY - dims.floorY;
    const fy = dims.floorY - 0.55;         // relative to the body centre
    body.addShape(new CANNON.Box(new CANNON.Vec3(dims.halfW, t, dims.halfL)),
      new CANNON.Vec3(0, fy, 0));
    [[dims.halfW, t, 0], [-dims.halfW, t, 0]].forEach(([x, , ]) => {
      body.addShape(new CANNON.Box(new CANNON.Vec3(t, h / 2, dims.halfL)),
        new CANNON.Vec3(x * 1.02, fy + h / 2, 0));
    });
    [[0, dims.halfL], [0, -dims.halfL]].forEach(([x, z]) => {
      body.addShape(new CANNON.Box(new CANNON.Vec3(dims.halfW, h / 2, t)),
        new CANNON.Vec3(x, fy + h / 2, z * 1.02));
    });
    body.sleepSpeedLimit = 0.12;
    body.sleepTimeLimit = 0.6;
    body.updateMassProperties();
    this.world.addBody(body);

    this.trolley = { body, object3d, dims, heading: 0, yaw: 0 };

    // keep it from tipping: it has wheels, so lock pitch and roll, allow yaw
    const lock = new CANNON.Body({ mass: 0 });
    void lock;
    return body;
  }

  /* Drive the trolley toward a hold point in front of the shopper with a spring:
     it accelerates, drags, and stops dead against the counter — the heading is
     integrated from its own velocity, so it swings through turns. */
  updateTrolley(targetPos, dt) {
    const t = this.trolley;
    if (!t) return;
    const b = t.body;
    const dx = targetPos.x - b.position.x;
    const dz = targetPos.z - b.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 2.4) {
      // a view change, not a push: move the whole trolley — and everything in it —
      // together. Snapping only the body used to strand a full basket behind you.
      this.teleportTrolley(targetPos.x, targetPos.z);
      return;
    }
    // critically-damped pull, not a lerp: the trolley has mass
    const kp = 26, kd = 9.2;
    const vx = b.velocity.x, vz = b.velocity.z;
    b.applyForce(new CANNON.Vec3(dx * kp - vx * kd, 0, dz * kp - vz * kd), b.position);

    // yaw follows travel; if it is nearly stopped, follow the shopper instead
    const speed = Math.hypot(vx, vz);
    const want = speed > 0.18 ? Math.atan2(vx, vz) : t.lastWant ?? b.quaternion.y;
    t.lastWant = want;
    let d = want - t.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    t.yaw += Math.max(-2.2 * dt, Math.min(2.2 * dt, d));
    b.quaternion.setFromEuler(0, t.yaw, 0);
    // wheels on tile: never let it pitch or roll, and keep it at ride height
    b.position.y = 0.55;
    b.velocity.y = 0;
    b.angularVelocity.x = 0;
    b.angularVelocity.z = 0;
  }

  /** Move the trolley and every pack inside it by the same delta. */
  teleportTrolley(x, z) {
    const t = this.trolley;
    if (!t) return;
    const dx = x - t.body.position.x;
    const dz = z - t.body.position.z;
    t.body.position.set(x, 0.55, z);
    t.body.velocity.set(0, 0, 0);
    t.body.angularVelocity.set(0, 0, 0);
    // anything sitting in the basket (within the basket footprint) travels with it
    this.packs.forEach(({ body }) => {
      const rx = body.position.x - (x - dx), rz = body.position.z - (z - dz);
      if (Math.hypot(rx, rz) < 0.9) {
        body.position.x += dx;
        body.position.z += dz;
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
      }
    });
  }

  /* ---------------------------------------------------------------- packs */
  /** Drop a pack into the trolley basket as a real rigid body. */
  addPack(mesh, size, position, quaternion) {
    const body = new CANNON.Body({
      mass: 1.1,
      material: this.mats.pack,
      shape: new CANNON.Box(new CANNON.Vec3(size.w / 2, size.h / 2, size.d / 2)),
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: 0.05,
      angularDamping: 0.42,
      allowSleep: true,
      sleepSpeedLimit: 0.18,
      sleepTimeLimit: 0.45,
    });
    if (quaternion) body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    this.world.addBody(body);
    const entry = { body, mesh, size };
    this.packs.push(entry);
    mesh.userData.physics = entry;
    return entry;
  }

  removePack(entry) {
    const i = this.packs.indexOf(entry);
    if (i >= 0) this.packs.splice(i, 1);
    this.world.removeBody(entry.body);
  }

  /* ---------------------------------------------------------------- step */
  stepWorld(dt) {
    this.accumulator = Math.min(this.accumulator + dt, 0.1);
    let steps = 0;
    while (this.accumulator >= this.step && steps < 4) {
      this.world.step(this.step);
      this.accumulator -= this.step;
      steps++;
    }
    // push solved transforms into the render scene
    for (let i = 0; i < this.packs.length; i++) {
      const { body, mesh } = this.packs[i];
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    }
  }

  syncTrolley() {
    const t = this.trolley;
    if (!t) return;
    t.object3d.position.set(t.body.position.x, 0, t.body.position.z);
    t.object3d.rotation.y = t.yaw + Math.PI;
  }

  /** Nearest free spot in the basket to drop the next pack, from the handle side. */
  basketDropPoint(lateral = 0) {
    const t = this.trolley;
    if (!t) return new THREE.Vector3(0, 1, 0);
    const b = t.body;
    const cos = Math.cos(t.yaw), sin = Math.sin(t.yaw);
    // sit the pack low in the basket and let gravity settle it
    const lx = lateral, lz = -0.12;
    return new THREE.Vector3(
      b.position.x + lx * cos + lz * sin,
      t.dims.floorY + 0.22,
      b.position.z - lx * sin + lz * cos
    );
  }
}
