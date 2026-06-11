use wasm_bindgen::prelude::*;
use js_sys::{Float32Array, Uint8Array, Int16Array};

#[wasm_bindgen]
pub struct PhysicsWorld {
    pub peg_count: usize,
    pub ball_count: usize,
    // Private fields prevent wasm-bindgen from auto-generating Copy-requiring getters
    ball_data: Vec<f32>,
    ball_states: Vec<u8>,
    peg_data: Vec<f32>,
    peg_states: Vec<u8>,
    peg_hit_counts: Vec<i16>,
}

#[wasm_bindgen]
impl PhysicsWorld {
    #[wasm_bindgen(constructor)]
    pub fn new(max_pegs: usize, max_balls: usize) -> PhysicsWorld {
        PhysicsWorld {
            peg_count: 0,
            ball_count: 0,
            ball_data: vec![0.0; max_balls * 4],
            ball_states: vec![0; max_balls],
            peg_data: vec![0.0; max_pegs * 2],
            peg_states: vec![0; max_pegs],
            peg_hit_counts: vec![0; max_pegs],
        }
    }

    // Explicit getters returning zero-copy views into WASM linear memory
    #[wasm_bindgen(getter)]
    pub fn ball_data(&self) -> Float32Array {
        unsafe { Float32Array::view(&self.ball_data) }
    }

    #[wasm_bindgen(getter)]
    pub fn ball_states(&self) -> Uint8Array {
        unsafe { Uint8Array::view(&self.ball_states) }
    }

    #[wasm_bindgen(getter)]
    pub fn peg_data(&self) -> Float32Array {
        unsafe { Float32Array::view(&self.peg_data) }
    }

    #[wasm_bindgen(getter)]
    pub fn peg_states(&self) -> Uint8Array {
        unsafe { Uint8Array::view(&self.peg_states) }
    }

    #[wasm_bindgen(getter)]
    pub fn peg_hit_counts(&self) -> Int16Array {
        unsafe { Int16Array::view(&self.peg_hit_counts) }
    }

    #[wasm_bindgen]
    pub fn step(&mut self, dt: f32, gravity: f32, max_speed: f32, grid_size: f32) {
        let sub_dt = dt / 4.0;
        for _ in 0..4 {
            self.apply_mutual_gravity(grid_size, sub_dt);
            self.integrate_balls(gravity, sub_dt, max_speed);
            self.ccd_ball_peg(grid_size, sub_dt);
            self.ball_ball_collisions();
            self.ball_wall_floor();
        }
    }

    fn apply_mutual_gravity(&mut self, grid_size: f32, sub_dt: f32) {
        if self.ball_count < 2 { return; }
        let g_const = 0.015;
        let epsilon_sq = 144.0;
        let grid_size_inv = 1.0 / grid_size;
        let cols = 100; 
        let mut grid: Vec<Vec<usize>> = vec![Vec::new(); cols * cols];
        
        for i in 0..self.ball_count {
            if self.ball_states[i] == 0 { continue; }
            let cx = ((self.ball_data[i * 4] * grid_size_inv) as usize).min(cols - 1);
            let cy = ((self.ball_data[i * 4 + 1] * grid_size_inv) as usize).min(cols - 1);
            grid[cy * cols + cx].push(i);
        }

        let r_cutoff_sq = 150.0 * 150.0;
        for i in 0..self.ball_count {
            if self.ball_states[i] == 0 { continue; }
            let cx = ((self.ball_data[i * 4] * grid_size_inv) as usize).min(cols - 1);
            let cy = ((self.ball_data[i * 4 + 1] * grid_size_inv) as usize).min(cols - 1);
            for dx in -1..=1 {
                for dy in -1..=1 {
                    let nx = (cx as isize + dx).rem_euclid(cols as isize) as usize;
                    let ny = (cy as isize + dy).rem_euclid(cols as isize) as usize;
                    for &j in &grid[ny * cols + nx] {
                        if i == j || self.ball_states[j] == 0 { continue; }
                        let ix = i * 4;
                        let jx = j * 4;
                        let dx_b = self.ball_data[jx] - self.ball_data[ix];
                        let dy_b = self.ball_data[jx + 1] - self.ball_data[ix + 1];
                        let d_sq = dx_b * dx_b + dy_b * dy_b;
                        if d_sq < r_cutoff_sq && d_sq > 0.1 {
                            let d = d_sq.sqrt();
                            let force = g_const / (d_sq + epsilon_sq) * sub_dt;
                            self.ball_data[ix + 2] += (dx_b / d) * force;
                            self.ball_data[ix + 3] += (dy_b / d) * force;
                        }
                    }
                }
            }
        }
    }

    fn integrate_balls(&mut self, gravity: f32, sub_dt: f32, max_speed: f32) {
        for i in 0..self.ball_count {
            if self.ball_states[i] == 0 { continue; }
            let idx = i * 4;
            self.ball_data[idx + 3] += gravity * sub_dt;
            
            let speed = (self.ball_data[idx + 2].powi(2) + self.ball_data[idx + 3].powi(2)).sqrt();
            if speed > max_speed {
                let scale = max_speed / speed;
                self.ball_data[idx + 2] *= scale;
                self.ball_data[idx + 3] *= scale;
            }
            
            self.ball_data[idx] += self.ball_data[idx + 2] * sub_dt;
            self.ball_data[idx + 1] += self.ball_data[idx + 3] * sub_dt;
        }
    }

    fn ccd_ball_peg(&mut self, grid_size: f32, _sub_dt: f32) {
        let grid_size_inv = 1.0 / grid_size;
        let cols = 100;
        let mut grid: Vec<Vec<usize>> = vec![Vec::new(); cols * cols];
        for i in 0..self.peg_count {
            if self.peg_states[i] == 0 { continue; }
            let cx = ((self.peg_data[i * 2] * grid_size_inv) as usize).min(cols - 1);
            let cy = ((self.peg_data[i * 2 + 1] * grid_size_inv) as usize).min(cols - 1);
            grid[cy * cols + cx].push(i);
        }
        let ball_r: f32 = 4.0; 
        let peg_r: f32 = 5.0;
        let collision_dist_sq = (ball_r + peg_r).powi(2);
        
        for i in 0..self.ball_count {
            if self.ball_states[i] == 0 { continue; }
            let idx = i * 4;
            let bx = self.ball_data[idx]; 
            let by = self.ball_data[idx + 1];
            let bvx = self.ball_data[idx + 2]; 
            let bvy = self.ball_data[idx + 3];
            let cx = ((bx * grid_size_inv) as usize).min(cols - 1);
            let cy = ((by * grid_size_inv) as usize).min(cols - 1);
            
            for dx in -1..=1 {
                for dy in -1..=1 {
                    let nx = (cx as isize + dx).rem_euclid(cols as isize) as usize;
                    let ny = (cy as isize + dy).rem_euclid(cols as isize) as usize;
                    for &pid in &grid[ny * cols + nx] {
                        if self.peg_states[pid] == 0 { continue; }
                        let px = self.peg_data[pid * 2]; 
                        let py = self.peg_data[pid * 2 + 1];
                        let fx = bx - px; 
                        let fy = by - py;
                        let a = bvx * bvx + bvy * bvy;
                        let b_coeff = 2.0 * (fx * bvx + fy * bvy);
                        let c = fx * fx + fy * fy - collision_dist_sq;
                        let disc = b_coeff * b_coeff - 4.0 * a * c;
                        
                        if disc >= 0.0 && a > 0.0001 {
                            let t = (-b_coeff - disc.sqrt()) / (2.0 * a);
                            if t >= 0.0 && t <= 1.0 {
                                let hx = bx + t * bvx; 
                                let hy = by + t * bvy;
                                let nx_val = hx - px; 
                                let ny_val = hy - py;
                                let nl = (nx_val * nx_val + ny_val * ny_val).sqrt();
                                let nnx = nx_val / nl; 
                                let nny = ny_val / nl;
                                let dot = bvx * nnx + bvy * nny;
                                
                                self.ball_data[idx + 2] = bvx - 2.0 * dot * nnx;
                                self.ball_data[idx + 3] = bvy - 2.0 * dot * nny;
                                self.ball_data[idx] = hx + nnx * 0.5;
                                self.ball_data[idx + 1] = hy + nny * 0.5;
                                
                                self.peg_hit_counts[pid] += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    fn ball_ball_collisions(&mut self) {
        let r: f32 = 4.0; 
        let min_d = r * 2.0; 
        let min_d_sq = min_d * min_d;
        for i in 0..self.ball_count {
            if self.ball_states[i] == 0 { continue; }
            for j in (i + 1)..self.ball_count {
                if self.ball_states[j] == 0 { continue; }
                let ix = i * 4;
                let jx = j * 4;
                let dx = self.ball_data[jx] - self.ball_data[ix];
                let dy = self.ball_data[jx + 1] - self.ball_data[ix + 1];
                let d_sq = dx * dx + dy * dy;
                if d_sq < min_d_sq && d_sq > 0.001 {
                    let d = d_sq.sqrt();
                    let nx = dx / d; 
                    let ny = dy / d;
                    let dvx = self.ball_data[ix + 2] - self.ball_data[jx + 2];
                    let dvy = self.ball_data[ix + 3] - self.ball_data[jx + 3];
                    let dvn = dvx * nx + dvy * ny;
                    if dvn > 0.0 {
                        self.ball_data[ix + 2] -= dvn * nx;
                        self.ball_data[ix + 3] -= dvn * ny;
                        self.ball_data[jx + 2] += dvn * nx;
                        self.ball_data[jx + 3] += dvn * ny;
                        
                        let ov = (min_d - d) / 2.0 + 0.5;
                        self.ball_data[ix] -= nx * ov;
                        self.ball_data[ix + 1] -= ny * ov;
                        self.ball_data[jx] += nx * ov;
                        self.ball_data[jx + 1] += ny * ov;
                    }
                }
            }
        }
    }

    fn ball_wall_floor(&mut self) {
        let wall_l: f32 = 50.0; 
        let wall_r: f32 = 750.0; 
        let r: f32 = 4.0;
        for i in 0..self.ball_count {
            if self.ball_states[i] == 0 { continue; }
            let idx = i * 4;
            let mut x = self.ball_data[idx];
            let y = self.ball_data[idx + 1]; // Removed 'mut' to fix warning
            let mut vx = self.ball_data[idx + 2];
            
            if x - r < wall_l { 
                x = wall_l + r; 
                vx = vx.abs(); 
            }
            if x + r > wall_r { 
                x = wall_r - r; 
                vx = -vx.abs(); 
            }
            if y > 2000.0 { 
                self.ball_states[i] = 0; 
            }
            
            self.ball_data[idx] = x;
            self.ball_data[idx + 2] = vx;
        }
    }

    #[wasm_bindgen]
    pub fn spawn_ball(&mut self, x: f32, y: f32, vx: f32, vy: f32) {
        if self.ball_count >= 50 {
            return;
        }
        let idx = self.ball_count * 4;
        self.ball_data[idx] = x;
        self.ball_data[idx + 1] = y;
        self.ball_data[idx + 2] = vx;
        self.ball_data[idx + 3] = vy;
        self.ball_states[self.ball_count] = 1;
        self.ball_count += 1;
    }
}