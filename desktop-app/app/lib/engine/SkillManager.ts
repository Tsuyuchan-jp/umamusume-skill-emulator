
import type { RaceSimulator } from './RaceSimulator';
import { normalSkillData, uniqueSkillData } from './data/skillData';
import * as RCP from './data/release_conserve_power_constants';

const effects = [
  "heal",
  "targetSpeed",
  "acceleration",
  "speed",
  "speedWithDecel",
  "fatigue",
  "passiveSpeed",
  "passiveStamina",
  "passivePower",
  "passiveGuts",
  "passiveWisdom",
  "temptationRate",
  "startDelay",
];

const inheritMap = {
  heal: {
    750: 350,
    550: 150,
    350: 50,
    150: 35,
    "-100": -100,
    "-300": -300,
  },
  targetSpeed: {
    0.55: 0.15,
    0.45: 0.25,
    0.4: 0.2,
    0.385: 0.15,
    0.35: 0.15,
    0.3: 0.075,
    0.25: 0.05,
    0.15: 0.035,
    "-0.05": -0.05,
  },
  speedWithDecel: {
    0.55: 0.15,
    0.45: 0.25,
    0.4: 0.2,
    0.385: 0.15,
    0.35: 0.15,
    0.3: 0.075,
    0.25: 0.05,
    0.15: 0.035,
    "-0.05": -0.05,
  },
  acceleration: {
    0.5: 0.3,
    0.4: 0.2,
    0.3: 0.1,
    0.2: 0.07, // 0.05 => 0.07 bugfix
    0.1: 0.05,
  },
};

function toInheritValues(invoke) {
  const ret = { ...invoke };
  for (const effect of effects) {
    if (invoke[effect] && inheritMap[effect]) {
      const map = inheritMap[effect];
      const value = invoke[effect];
      let newValue = map[value];
      if (newValue == null) {
        console.error(
          `Unknown ${effect} value ${value} in ${JSON.stringify(invoke)}`
        );
      }
      ret[effect] = newValue;
    }
  }
  return ret;
}

function rewriteInheritValues(inherit) {
  const variant = {
    id: inherit.id + 800000,
    name: inherit.name,
    rarity: "inherit",
  };
  if (inherit.duration) {
    inherit.duration = inherit.duration * 0.6;
  }
  for (const effect of effects) {
    if (inherit[effect] && inheritMap[effect]) {
      const map = inheritMap[effect];
      const value = inherit[effect];
      let newValue = map[value];
      if (newValue == null) {
        console.error(
          `Unknown ${effect} value ${value} in ${JSON.stringify(inherit)}`
        );
      }
      variant[effect] = newValue;
      delete inherit[effect];
    }
  }

  if (inherit.invokes) {
    variant.invokes = [];
    for (let i in inherit.invokes) {
      variant.invokes[i] = toInheritValues(inherit.invokes[i]);
    }
    delete inherit.invokes;
  }

  delete inherit.id;
  delete inherit.name;
  return variant;
}

export class SkillManager {
  public sim: RaceSimulator;
  public normalSkillData: any[];
  public uniqueSkillData: any[];
  public skills: any[] = [];
  public effects: string[] = [
    "heal", "targetSpeed", "acceleration", "speed", "speedWithDecel", 
    "fatigue", "passiveSpeed", "passiveStamina", "passivePower", 
    "passiveGuts", "passiveWisdom", "temptationRate", "startDelay"
  ];
  public hasSkills: any = {};
  public hasEvoSkills: any[] = [];
  public operatingSkills: any[] = [];
  public coolDownMap: any = {};
  public healTriggerCount: number = 0;
  public types: string[] = ['passive', 'heal', 'speed', 'acceleration', 'composite', 'gate', 'decel', 'fatigue'];
  public raritySections: string[] = ['rare', 'normal', 'inherit', 'all'];
  public skillTriggerCount: any = {};
  public passiveTriggered: number = 0;
  public invokedSkills: any[] = [];
  public oonige: boolean = false;
  public production: boolean = true;
  public selectedUnique: string = '';
  public uniqueSkillFilterQuery: string = '';
  public uniqueLevel: number = 4;
  public emulatorType: string = '';
  
  // mock for translations
  public $t(key: string) { return key; }
  public $te(key: string) { return false; }
  
  public resetHasSkills(): any {
    const hasSkills: any = {};
    for (const type of this.types) {
      hasSkills[type] = {};
      for (const section of this.raritySections) {
        hasSkills[type][section] = [];
      }
    }
    this.hasSkills = hasSkills;
    this.hasEvoSkills = [];
  }

  get rcpPower() {
    return this.sim.modifiedPower;
  }

  get leadCompetition() {
    return this.sim.umaStatus?.leadCompetition ?? "no";
  }

  get systematicSkills() {
    const thiz = this;
    return {
      leadCompetition: {
        id: "leadCompetition",
        systematic: true,
        name: "leadCompetition",
        targetSpeed: Math.pow(500 * this.sim.modifiedGuts, 0.6) * 0.0001,
        cd: 999999,
        duration: (Math.pow(700 * this.sim.modifiedGuts, 0.5) * 0.012) / this.sim.timeCoef,
        check: function (startPosition) {
          return startPosition >= 150;
        },
      },
      rcp: {
        id: "rcp",
        systematic: true,
        name: "rcp",
        cd: 999999,
        acceleration: Math.sqrt((this.rcpPower - 1200) * RCP.RELEASE_CONSERVE_POWER_DECEL_COEF) *
          RCP.RELEASE_CONSERVE_POWER_ACCEL_COEF * this.rcp_dis_running_style_coef(),
        duration: (RCP.RELEASE_CONSERVE_POWER_INITIAL_DURATION_SEC * 1000) / this.sim.timeCoef,
        check: function () {
          return thiz.sim.currentPhase >= 2;
        },
      },
    };
  }

  public rcp_dis_running_style_coef(): number {
    const distType = this.sim.trackDetail.distanceType;
    const style = this.sim.runningStyle;
    if (distType === 1 && style === 1) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.SHORT_NIGE;
    if (distType === 1 && style === 2) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.SHORT_SEN;
    if (distType === 1 && style === 3) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.SHORT_SASI;
    if (distType === 1 && style === 4) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.SHORT_OI;
    if (distType === 2 && style === 1) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.MILE_NIGE;
    if (distType === 2 && style === 2) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.MILE_SEN;
    if (distType === 2 && style === 3) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.MILE_SASI;
    if (distType === 2 && style === 4) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.MILE_OI;
    if (distType === 3 && style === 1) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.MIDDLE_NIGE;
    if (distType === 3 && style === 2) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.MIDDLE_SEN;
    if (distType === 3 && style === 3) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.MIDDLE_SASI;
    if (distType === 3 && style === 4) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.MIDDLE_OI;
    if (distType === 4 && style === 1) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.LONG_NIGE;
    if (distType === 4 && style === 2) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.LONG_SEN;
    if (distType === 4 && style === 3) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.LONG_SASI;
    if (distType === 4 && style === 4) return RCP.RELEASE_CONSERVE_POWER_RUNNING_STYLE_COEF_ARR.LONG_OI;
    return 1.0;
  }

  constructor(sim: RaceSimulator) {
    this.sim = sim;
    this.normalSkillData = normalSkillData(sim);
    this.uniqueSkillData = uniqueSkillData(sim);
    this.buildSkillData();
    this.resetHasSkills();
  }

  
  public filterUniqueSkills(query): any {
      this.uniqueSkillFilterQuery = query;
    }
  public clearUniqueSkillFilter(): any {
      this.uniqueSkillFilterQuery = "";
    }
  public invokeSkills(skillActivateAdjustment): any {
      this.invokedSkills = [];
      this.coolDownMap = {};
      this.skillTriggerCount = {
        0: 0,
        1: 0,
        2: 0,
        3: 0,
        phase2FinalCorner: 0,
        laterHalf: 0,
      };
      this.healTriggerCount = 0;

      const hasSkills = [];
      const idMap = this.skills.map((x) => x.id);
      for (const type of this.types) {
        for (const section of this.raritySections) {
          for (const id of this.hasSkills[type][section]) {
            hasSkills.push(this.skills[idMap.indexOf(id)]);
          }
        }
      }
      let uq;
      if (this.selectedUnique) {
        uq = this.skills[idMap.indexOf(this.selectedUnique)];
        if (uq && this.uniqueLevel > 0) {
          hasSkills.push(uq);
        }
      }
      for (const evoSkillId of this.hasEvoSkills) {
        const evoSkill = this.skills[idMap.indexOf(evoSkillId)];
        if (uq && evoSkill.holder === uq.holder) {
          hasSkills.push(evoSkill);
        }
      }

      for (const skill of hasSkills) {
        let invokeRate;
        if (skill.type === "fatigue" || skill.type === "decel") {
          invokeRate = 90;
        } else if (
          skill.type === "passive" ||
          skill.type === "unique" ||
          skillActivateAdjustment === "1" ||
          skillActivateAdjustment === "2" ||
          skillActivateAdjustment === "expected"
        ) {
          invokeRate = 100;
        } else {
          if (this.production) {
            invokeRate = Math.max(100 - 9000.0 / this.sim.umaStatus.wisdom, 20);
          } else {
            // For debug, always pass wisdom check
            invokeRate = 100;
          }
        }
        const { invokes: skillInvokes, ...rest } = skill;
        const invokes = [];
        if (skillInvokes) {
          for (const invoke of skillInvokes) {
            invokes.push(this.reshapeSkill({ ...rest, ...invoke }));
          }
        } else {
          invokes.push(skill);
        }
        for (const invoke of invokes) {
          if (Math.random() * 100 < invokeRate) {
            const copy = { ...invoke };
            if (copy.init) {
              copy.init();
            }
            this.initSkillConditions(copy);
            this.invokedSkills.push(copy);
          }
        }
      }
    }
    /**
     * @returns {(function(): boolean)|(function(*): void)|(function(*): boolean)}
     * check or randoms.
     */
  public checkCondition(skill, cond, value): any {
      const thiz = this.sim;
      switch (cond) {
        case "motivation":
          return parseInt(value) === 5 - +thiz.umaStatus.condition;
        case "hp_per":
          if (value.startsWith(">=")) {
            return () =>
              thiz.sp >= parseInt(value.substring(2)) * 0.01 * thiz.spMax;
          } else if (value.startsWith("<=")) {
            return () =>
              thiz.sp <= parseInt(value.substring(2)) * 0.01 * thiz.spMax;
          } else {
            console.error("Unknown hp_per value", value);
            return null;
          }
        case "activate_count_heal":
          return () => thiz.healTriggerCount >= value;
        case "activate_count_all":
          return () =>
            thiz.skillTriggerCount[0] +
              thiz.skillTriggerCount[1] +
              thiz.skillTriggerCount[2] +
              thiz.skillTriggerCount[3] >=
            value;
        case "activate_count_start":
          return () => thiz.skillTriggerCount[0] >= value;
        case "activate_count_later_half":
          return () => thiz.skillTriggerCount.laterHalf >= value;
        case "accumulatetime":
          return () => thiz.accTimePassed(value);
        case "straight_front_type":
          return () => thiz.getStraightFrontType() == value;
        case "is_badstart":
          if (value == 0) {
            return () => thiz.startDelay < 0.08;
          } else if (value == 1) {
            return () => thiz.startDelay >= 0.08;
          } else {
            return null;
          }
        case "temptation_count":
          return () => thiz.temptationSection < 0;
        case "remain_distance":
          if (typeof value === "number") {
            return (startPosition) =>
              thiz.isContainsRemainingDistance(value, startPosition);
          } else if (typeof value === "string") {
            if (value.startsWith(">=")) {
              return (startPosition) =>
                startPosition <=
                thiz.toPosition(parseInt(value.toString().substring(2)));
            } else if (value.startsWith("<=")) {
              return (startPosition) =>
                startPosition >=
                thiz.toPosition(parseInt(value.toString().substring(2)));
            } else {
              console.error("Unknown remain_distance value", value);
              return null;
            }
          } else if (Array.isArray(value)) {
            return (startPosition) =>
              startPosition >= thiz.toPosition(value[1]) &&
              startPosition <= thiz.toPosition(value[0]);
          } else {
            console.error("Unknown remain_distance value", value);
            return null;
          }
        case "distance_rate_after_random":
          return this.initIntervalRandom(value * 0.01, 1);
        case "distance_rate_random":
          return thiz.initIntervalRandom(value[0] * 0.01, value[1] * 0.01);
        case "corner_random":
          return this.initCornerRandom(value);
        case "all_corner_random":
          return this.initAllCornerRandom();
        case "slope":
          return () => thiz.isInSlope(["", "up", "down"][value]);
        case "up_slope_random":
          return this.initSlopeRandom("up");
        case "down_slope_random":
          return this.initSlopeRandom("down");
        case "running_style":
          if (typeof value === "number") {
            return () => thiz.isRunningStyle(value);
          } else if (Array.isArray(value)) {
            return () => value.includes(thiz.basicRunningStyle);
          } else {
            console.error("Unknown running_style value", value);
            return null;
          }
        case "rotation":
          return () => thiz.isRotation(value);
        case "ground_type":
          return () => thiz.isGroundType(value);
        case "ground_condition":
          return () => thiz.isGroundCondition(value);
        case "distance_type":
          return () => thiz.isDistanceType(value);
        case "track_id":
          return () => thiz.isTrackId(value);
        case "is_basis_distance":
          return () => thiz.isBasisDistance(value);
        case "distance_rate": {
          let values;
          if (Array.isArray(value)) {
            if (typeof value[0] === "number") {
              values = [`>=${value[0]}`, `<=${value[1]}`];
            } else {
              values = value;
            }
          } else {
            values = [value];
          }
          const ret = [];
          for (const v of values) {
            ret.push(() => {
              if (v.startsWith(">=")) {
                return thiz.isInInterval(parseInt(v.substring(2)) * 0.01, 1);
              } else if (v.startsWith("<=")) {
                return thiz.isInInterval(0, parseInt(v.substring(2)) * 0.01);
              }
            });
          }
          return ret;
        }
        case "phase_random":
          return thiz.initPhaseRandom(value);
        case "phase_firsthalf_random":
          return thiz.initPhaseRandom(value, { endRate: 0.5 });
        case "phase_firstquarter_random":
          return thiz.initPhaseRandom(value, { endRate: 0.25 });
        case "phase_laterhalf_random":
          return thiz.initPhaseRandom(value, { startRate: 0.5 });
        case "phase_corner_random":
          return thiz.initPhaseCornerRandom(value);
        case "is_finalcorner_random":
          return thiz.initFinalCornerRandom(value);
        case "is_finalstraight_random":
          return thiz.initFinalStraightRandom();
        case "straight_random":
          return thiz.initStraightRandom();
        case "is_last_straight":
          return thiz.isInFinalStraight;
        case "phase":
          if (typeof value === "string") {
            if (value.startsWith(">=")) {
              return () => thiz.currentPhase >= parseInt(value.substring(2));
            } else if (value.startsWith(">")) {
              return () => thiz.currentPhase > parseInt(value.substring(1));
            } else if (value.startsWith("<=")) {
              return () => thiz.currentPhase <= parseInt(value.substring(2));
            } else if (value.startsWith("<")) {
              return () => thiz.currentPhase < parseInt(value.substring(1));
            } else {
              console.error("Unknown phase value", value);
              return null;
            }
          } else {
            return () => thiz.currentPhase == value;
          }
        case "is_finalcorner":
          return () => thiz.isInFinalStraight() || thiz.isInFinalCorner();
        case "is_finalcorner_laterhalf":
          return () => thiz.isInFinalCorner(null, { start: 0.5, end: 1 });
        case "corner":
          if (value == 0) {
            return () => !thiz.isInCorner();
          } else if (value === 1) {
            // Use '1' over 1 if you want exact first corner
            return () => thiz.isInCorner();
          } else {
            return () => thiz.isInCorner(thiz.position, value);
          }
        case "is_activate_any_skill":
          return () => thiz.skillTriggerCount.finalCorner >= 1;
        case "is_lastspurt":
          if (value == 0) {
            return () => !thiz.isInSpurt;
          } else {
            return () => thiz.isInSpurt;
          }
        case "lastspurt":
          switch (value) {
            case 1:
              return () =>
                thiz.isInSpurt &&
                thiz.spurtParameters.speed < thiz.maxSpurtSpeed;
            case 2:
              return () => thiz.spurtParameters?.speed == thiz.maxSpurtSpeed;
          }
          break;
        case "base_speed":
          return () => thiz.umaStatus.speed >= value;
        case "base_power":
          return () => thiz.umaStatus.power >= value;
        case "base_wiz":
          return () => thiz.umaStatus.wisdom >= value;
        case "course_distance":
          return () => thiz.courseLength == value;
        default:
          alert(`Unknown condition ${cond}`);
          console.error(`Unknown condition ${cond}`);
          break;
      }
    }
  public initSkillConditions(skill): any {
      if (!skill.conditions) {
        if (!skill.check) {
          skill.check = () => true;
        }
        return;
      }
      const thiz = this.sim;
      const checks = skill.check ? [skill.check] : [];
      skill.randoms = [];
      for (const cond in skill.conditions) {
        const value = skill.conditions[cond];
        const res = this.checkCondition(skill, cond, value);
        if (res == null) {
          // Do nothing
        } else if (res instanceof Function) {
          checks.push(res);
        } else if (Array.isArray(res)) {
          if (res.length > 0) {
            if (res[0].start) {
              // Randoms
              skill.randoms = res;
              checks.push((startPosition) =>
                thiz.isInRandom(skill.randoms, startPosition)
              );
            } else if (res[0] instanceof Function) {
              // Multiple conditions
              checks.push(...res);
            } else {
              console.error("Unknown res array", cond, res);
            }
          } else {
            // Empty random array = won't trigger
            checks.push(() => false);
          }
        } else {
          console.error("Unknown res type", cond, res);
        }
      }
      skill.check = function (startPosition) {
        for (const check of checks) {
          if (!check(startPosition)) return false;
        }
        return true;
      };
    }
  public triggerStartSkills(): any {
      const nonStartSkills = [];
      for (const skill of this.invokedSkills) {
        switch (skill.type) {
          case "passive": {
            let triggered = true;
            if (skill.id === 202051) {
              // 大逃げ
              this.oonige = true;
            } else if (skill.check && skill.check()) {
              if (
                "triggerRate" in skill &&
                Math.random() >= skill.triggerRate
              ) {
                triggered = false;
              } else {
                skill.trigger(skill);
              }
            }
            if (triggered && skill.systematic !== true) {
              this.skillTriggerCount[0]++;
              this.passiveTriggered += 1;
              this.frames[0].skills.push({ data: skill });
            }
            break;
          }
          case "gate":
            this.sim.startDelay *= skill.startDelay;
            skill.trigger(skill);
            if (skill.duration > 0) {
              this.operatingSkills.push({
                data: skill,
                startFrame: this.sim.frameElapsed,
              });
            }
            if (skill.systematic !== true) {
              this.skillTriggerCount[0]++;
            }
            this.frames[0].skills.push({ data: skill });
            break;
          default:
            nonStartSkills.push(skill);
            break;
        }
      }
      this.invokedSkills = nonStartSkills;
    }
  public initSystematicSkills(): any {
      if (this.sim.isRunningStyle(1) && this.leadCompetition === "yes") {
        this.invokedSkills.push(this.systematicSkills.leadCompetition);
      }
      if (this.rcpPower > 1200) {
        this.invokedSkills.push(this.systematicSkills.rcp);
      }
    }
  public checkSkillTrigger(startPosition): any {
      const skillTriggered = [];
      for (const skill of this.invokedSkills) {
        if (this.isInCoolDown(skill)) {
          continue;
        }
        if (skill.check(startPosition)) {
          const skillDetail = this.triggerSkill(skill);
          for (const chained of skillDetail?.chainTriggered ?? []) {
            const chainDetail = this.triggerSkill(chained);
            skillTriggered.push({ data: chained, detail: chainDetail });
          }
          skillTriggered.push({ data: skill, detail: skillDetail });
        }
      }
      return skillTriggered;
    }
  public triggerSkill(skill): any {
      let skillDetail = null;
      if (skill.trigger) {
        skillDetail = skill.trigger(skill);
      }
      if (skill.heal) {
        skillDetail = this.doHeal(skill.heal);
      }
      if (skill.duration || skill.durationOverwrite) {
        this.operatingSkills.push({
          data: skill,
          startFrame: this.sim.frameElapsed,
        });
      }
      if (skill.systematic !== true) {
        this.skillTriggerCount[this.sim.currentPhase]++;
        // 特殊スキル誘発カウント
        if (this.sim.isInFinalCorner() && this.sim.currentPhase >= 2) {
          this.skillTriggerCount.phase2FinalCorner++;
        }
        if (this.sim.isInLaterHalf()) {
          this.skillTriggerCount.laterHalf++;
        }
      }
      const coolDownId = skill.invokeNo
        ? `${skill.id}-${skill.invokeNo}`
        : skill.id;
      this.coolDownMap[coolDownId] = this.sim.frameElapsed;
      return skillDetail;
    }
  public chooseRandom(zoneStart, zoneEnd): any {
      let rate;
      if (this.sim.skillActivateAdjustment === "expected") {
        rate = 0.5;
      } else {
        switch (this.sim.randomPosition) {
          case "0":
            rate = Math.random();
            break;
          case "1":
            rate = 0;
            break;
          case "2":
            rate = 0.25;
            break;
          case "3":
            rate = 0.5;
            break;
          case "4":
            rate = 0.75;
            break;
          case "5":
          default:
            rate = 0.98;
            break;
        }
      }

      const start = rate * (zoneEnd - zoneStart) + zoneStart;
      let end = start + 10;
      if (end > zoneEnd) {
        end = zoneEnd;
      }
      return { start, end };
    }
  public initCornerRandom(values): any {
      if (typeof values === "number") {
        values = [values];
      }
      const ret = [];
      const corners = this.sim.trackDetail.corners.slice(-4);
      for (let i = 0; i < 4 - corners.length; i++) {
        corners.unshift(null);
      }
      const targetCorners = [];
      for (const value of values) {
        if (corners[value - 1]) {
          targetCorners.push(corners[value - 1]);
        }
      }
      for (const corner of targetCorners) {
        ret.push(this.chooseRandom(corner.start, this.sim.cornerEnd(corner)));
      }
      return ret;
    }
  public initAllCornerRandom(): any {
      const corners = this.sim.trackDetail.corners.map((c) => ({
        start: c.start,
        length: c.length,
      }));
      const triggers = [];

      function logTrigger(min, max) {
        max = Math.max(min, max - 10);
        const start = min + Math.random() * (max - min);
        const end = start + 10;
        triggers.push({ start, end });
        triggers.sort((a, b) => a.start - b.start);
        return { start, end };
      }

      for (let x = 0; x < 4; x++) {
        if (corners.length < 1) {
          break;
        }
        const i = Math.floor(Math.random() * corners.length);
        const corner = corners[i];
        const trigger = logTrigger(corner.start, corner.start + corner.length);
        if (corner.start + corner.length - trigger.end >= 10) {
          corner.start = trigger.end;
          corner.length -= trigger.end - corner.start;
        } else {
          corners.splice(i, 1);
        }
        corners.splice(0, i);
      }
      return triggers;
    }
  public initStraightRandom(): any {
      let ret;
      const straights = this.sim.getStraights();
      const chosen = Math.floor(Math.random() * straights.length);
      ret = this.chooseRandom(straights[chosen].start, straights[chosen].end);
      return [ret];
    }
  public initSlopeRandom(dir): any {
      let ret;
      if (!this.sim.getSlopes()) return [];
      const slopes = this.sim.getSlopes().filter(
        (s) => (s.slope > 0 && dir == "up") || (s.slope < 0 && dir == "down")
      );
      if (slopes.length === 0) {
        return [];
      }
      const chosen = Math.floor(Math.random() * slopes.length);
      ret = this.chooseRandom(
        slopes[chosen].start,
        slopes[chosen].start + slopes[chosen].length
      );
      return [ret];
    }
  public initPhaseRandom(phase, options): any {
      const startRate = (options && options.startRate) || 0;
      const endRate = (options && options.endRate) || 1;
      let zoneStart, zoneEnd;
      switch (phase) {
        case 0:
          zoneStart = 0;
          zoneEnd = this.sim.courseLength / 6.0;
          break;
        case 1:
          zoneStart = this.sim.courseLength / 6.0;
          zoneEnd = (this.sim.courseLength * 2.0) / 3;
          break;
        case 2:
          zoneStart = (this.sim.courseLength * 2.0) / 3;
          zoneEnd = (this.sim.courseLength * 5.0) / 6;
          break;
        case 3:
        default:
          zoneStart = (this.sim.courseLength * 5.0) / 6;
          zoneEnd = this.sim.courseLength;
          break;
      }
      const zoneLength = zoneEnd - zoneStart;
      zoneStart += zoneLength * startRate;
      zoneEnd -= zoneLength * (1 - endRate);
      return [this.chooseRandom(zoneStart, zoneEnd)];
    }
  public initFinalCornerRandom(): any {
      const ret = [];
      const corner =
        this.sim.trackDetail.corners[this.sim.trackDetail.corners.length - 1];
      if (!corner) {
        return [];
      }
      ret.push(this.chooseRandom(corner.start, this.sim.cornerEnd(corner)));
      return ret;
    }
  public initPhaseCornerRandom(phase): any {
      const candidates = [];
      let phaseStart, phaseEnd;
      const courseLength = this.sim.courseLength;
      switch (phase) {
        case 0:
          phaseStart = 0;
          phaseEnd = courseLength / 6;
          break;
        case 1:
          phaseStart = courseLength / 6;
          phaseEnd = (courseLength * 2) / 3;
          break;
        case 2:
          phaseStart = (courseLength * 2) / 3;
          phaseEnd = (courseLength * 5) / 6;
          break;
        case 3:
        default:
          phaseStart = (courseLength * 5) / 6;
          phaseEnd = courseLength;
          break;
      }
      for (const corner of this.sim.trackDetail.corners) {
        const cornerStart = corner.start;
        const cornerEnd = this.sim.cornerEnd(corner);
        if (cornerEnd < phaseStart || cornerStart > phaseEnd) {
          continue;
        }
        candidates.push({
          start: Math.max(cornerStart, phaseStart),
          end: Math.min(cornerEnd, phaseEnd),
        });
      }
      if (candidates.length === 0) {
        return [];
      }
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      return [this.chooseRandom(chosen.start, chosen.end)];
    }
  public initFinalStraightRandom(): any {
      const ret = [];
      const finalCorner =
        this.sim.trackDetail.corners[this.sim.trackDetail.corners.length - 1];
      if (!finalCorner) {
        return [];
      }
      ret.push(
        this.chooseRandom(this.sim.cornerEnd(finalCorner), this.sim.courseLength)
      );
      return ret;
    }
  public initIntervalRandom(startRate, endRate): any {
      const start = this.sim.courseLength * startRate;
      const end = this.sim.courseLength * endRate;
      return [this.chooseRandom(start, end)];
    }
  public isInRandom(randoms): any {
      for (const random of randoms) {
        if (this.sim.position <= random.end && this.sim.position >= random.start) {
          return true;
        }
      }
      return false;
    }
  public isInCorner(position, cornerNumber, interval): any {
      if (!position) {
        position = this.sim.position;
      }
      for (const i in this.sim.trackDetail.corners) {
        const corner = this.sim.trackDetail.corners[i];
        const start = interval ? interval.start * corner.start : corner.start;
        let end = this.sim.cornerEnd(corner);
        if (interval) {
          end *= interval.end;
        }
        if (position >= start && position <= end) {
          if (cornerNumber) {
            return i == this.sim.trackDetail.corners.length + +cornerNumber - 5;
          } else {
            return true;
          }
        }
      }
      return false;
    }
    /**
     * @returns {number}
     * 0: Not in straight
     * 1: In front of stand
     * 2: Opposite of stand
     */
  public getStraightFrontType(position): any {
      if (!position) position = this.sim.position;
      for (const straight of this.sim.trackDetail.straights) {
        if (position >= straight.start && position <= straight.end) {
          const rIndex =
            this.sim.trackDetail.straights.length -
            this.sim.trackDetail.straights.indexOf(straight);
          return rIndex % 2 == 1 ? 1 : 2;
        }
      }
      return 0;
    }
  public isInStraight(position): any {
      if (!position) {
        position = this.sim.position;
      }
      for (const straight of this.sim.trackDetail.straights) {
        if (position >= straight.start && position <= straight.end) {
          return true;
        }
      }
      return false;
    }
  public isInFinalCorner(position, interval): any {
      if (!position) {
        position = this.sim.position;
      }
      const fc = this.sim.trackDetail.corners[this.sim.trackDetail.corners.length - 1];
      if (!fc) {
        return false;
      }
      const startRate = interval ? interval.start : 0;
      const endRate = interval ? interval.end : 1;
      const start = fc.start + startRate * fc.length;
      const end = fc.start + endRate * fc.length;
      return position >= start && position <= end;
    }
  public isInFinalStraight(position): any {
      if (!position) {
        position = this.sim.position;
      }
      const lastStraight =
        this.sim.trackDetail.straights[this.sim.trackDetail.straights.length - 1];
      if (!lastStraight) {
        return false;
      }
      return position >= lastStraight.start;
    }
  public isContainsRemainingDistance(remain, startPosition): any {
      return (
        startPosition <= this.sim.toPosition(remain) &&
        this.sim.position >= this.sim.toPosition(remain)
      );
    }
  public isInDistanceRate(startRate, endRate): any {
      return (
        this.sim.position >= this.sim.courseLength * startRate &&
        this.sim.position <= this.sim.courseLength * endRate
      );
    }
  public isSPInRange(minRate, maxRate): any {
      return this.sim.sp >= this.sim.spMax * minRate && this.sim.sp <= this.sim.spMax * maxRate;
    }
  public isPhase(phase): any {
      return this.sim.currentPhase === phase;
    }
  public isInLaterHalf(): any {
      return this.sim.position > this.sim.courseLength / 2;
    }
  public isStraightFrontType(type): any {
      switch (type) {
        case 2:
          for (const i in this.sim.trackDetail.straights) {
            const straight = this.sim.trackDetail.straights[i];
            if (
              this.sim.position >= straight.start &&
              this.sim.position <= straight.end
            ) {
              return i == this.sim.trackDetail.straights.length - 2;
            }
          }
          break;
      }
    }
  public isInInterval(start, end): any {
      return (
        this.sim.position >= this.sim.courseLength * start &&
        this.sim.position <= this.sim.courseLength * end
      );
    }
  public isInCoolDown(skill): any {
      const coolDownId = skill.invokeNo
        ? `${skill.id}-${skill.invokeNo}`
        : skill.id;
      if (!(coolDownId in this.coolDownMap)) {
        return false;
      }
      return (
        (this.sim.frameElapsed - this.coolDownMap[coolDownId]) / 15.0 <
        skill.cd * this.sim.timeCoef
      );
    }
  public doHeal(value): any {
      let detail;
      const heal = (this.sim.spMax * value) / 10000.0;
      this.sim.sp += heal;
      let waste = 0;
      if (this.sim.sp > this.sim.spMax) {
        waste = this.sim.sp - this.sim.spMax;
        this.sim.sp = this.sim.spMax;
      }
      if (waste > 0) {
        detail = { heal, waste };
      } else {
        detail = { heal, waste: 0 };
      }
      if (value > 0) {
        this.healTriggerCount++;
      }
      if (this.sim.currentPhase >= 2) {
        this.sim.spurtParameters = this.sim.calcSpurtParameter(true);
      }
      return detail;
    }
  public isRunningStyle(value): any {
      if (value == null) return true;
      const values = Array.isArray(value) ? value : [value];
      return values.includes(this.sim.basicRunningStyle);
    }
  public isGroundType(value): any {
      if (value == null) return true;
      return this.sim.trackDetail.surface == value;
    }
  public isRotation(value): any {
      if (value == null) return true;
      return this.sim.trackDetail.turn == value;
    }
  public isTrackId(value): any {
      if (value == null) return true;
      if (Array.isArray(value)) {
        return value.includes(this.sim.trackDetail.raceTrackId);
      } else {
        return this.sim.trackDetail.raceTrackId === value;
      }
    }
  public isBasisDistance(value): any {
      if (value == null) return true;
      else if (value === 1) {
        return this.sim.trackDetail.distance % 400 == 0;
      } else if (value === 0) {
        return this.sim.trackDetail.distance % 400 != 0;
      }
      return false;
    }
  public isDistanceType(value): any {
      if (value == null) return true;
      if (Array.isArray(value)) {
        return value.includes(this.sim.distanceType);
      } else {
        return this.sim.distanceType == value;
      }
    }
  public isGroundCondition(value): any {
      if (value == null) return true;
      if (Array.isArray(value)) {
        return value.indexOf(+this.sim.track.surfaceCondition) >= 0;
      } else {
        return this.sim.track.surfaceCondition == value;
      }
    }
  public accTimePassed(second): any {
      return this.sim.frameElapsed >= 15 * second;
    }
  public reshapeSkill(copy): any {
      const thiz = this.sim;

      if (copy.duration) {
        if (!copy.tooltip) copy.tooltip = "";
        copy.tooltip += ` | ${Math.round(copy.duration * 10) / 10}s`;
      }
      for (const effect of this.effects) {
        if (copy[effect]) {
          if (!copy.tooltip) copy.tooltip = "";
          copy.tooltip += ` | ${effect}: ${
            Math.round(copy[effect] * 100) / 100
          }`;
        }
      }

      if (!copy.cd) copy.cd = 500;
      const triggers = copy.trigger ? [copy.trigger] : [];

      let type = copy.type;
      let effectCount = 0;
      if (
        copy.passiveSpeed ||
        copy.passiveStamina ||
        copy.passivePower ||
        copy.passiveGuts ||
        copy.passiveWisdom ||
        copy.temptationRate
      ) {
        type = "passive";
        effectCount++;
      }
      if (copy.heal) {
        type = "heal";
        effectCount++;
      }
      if (copy.targetSpeed || copy.speedWithDecel) {
        type = "speed";
        effectCount++;
        if (copy.speedWithDecel) {
          triggers.push(() => {
            thiz.currentSpeed += copy.speedWithDecel;
          });
        }
      }
      if (copy.acceleration) {
        type = "acceleration";
        effectCount++;
      }
      if (copy.speed && copy.speed < 0) {
        type = "decel";
        effectCount++;
      }
      if (copy.fatigue) {
        type = "fatigue";
        effectCount++;
        triggers.push(() => {
          return thiz.doHeal(-copy.fatigue);
        });
      }
      const passiveStatus = [
        "passiveSpeed",
        "passiveStamina",
        "passivePower",
        "passiveGuts",
        "passiveWisdom",
      ];
      for (const status of passiveStatus) {
        if (copy[status]) {
          triggers.push(() => {
            thiz.passiveBonus[status.substring(7).toLowerCase()] +=
              copy[status];
          });
        }
      }
      if (copy.startDelay) {
        type = "gate";
        effectCount++;
      }
      if (effectCount > 1) {
        type = "composite";
      }
      if (!copy.type) {
        copy.type = type;
      }

      copy.trigger = function (skill) {
        let ret;
        for (const trigger of triggers) {
          let res = trigger(skill);
          if (res) ret = res;
        }
        return ret;
      };

      if (copy.tooltip?.startsWith(" | ")) {
        copy.tooltip = copy.tooltip.substring(3);
      }

      return copy;
    }
  public buildSkillData(): any {
      const normalSkillData = this.normalSkillData;
      const uniqueSkillData = this.uniqueSkillData;
      const skills = [];

      for (const skill of uniqueSkillData) {
        // Push unique skills
        const copy = { ...skill };
        this.reshapeSkill(copy);
        copy.type = "unique";
        skills.push(copy);

        // Build up inherit skills
        if (skill.noInherit) {
          continue;
        }
        const inherit = { ...skill };
        const variant = rewriteInheritValues(inherit);
        inherit.variants = [variant];
        normalSkillData.push(inherit);
      }

      // Flatten rarity wrapper
      for (const skillWrapper of normalSkillData) {
        const { variants, ...commonPart } = skillWrapper;
        for (const variant of variants) {
          const copy = { ...commonPart, ...variant };
          skills.push(this.reshapeSkill(copy));
        }
      }

      this.skills = skills;
    }
  public resetHasSkills(): any {
      const o = {};
      for (const type of this.types) {
        o[type] = {};
        for (const section of this.raritySections) {
          o[type][section] = [];
        }
      }
      this.hasSkills = o;
      this.hasEvoSkills = [];
    }
  public toRaritySection(rarity): any {
      if (rarity === "double") {
        return "rare";
      } else {
        return rarity;
      }
    }
  public localizeSkill(skill, wrapper, newSkillNames): any {
      const jaName = skill.name;
      const localName = this.$t(`skill.${jaName}`);
      if (localName.startsWith("skill.")) {
        newSkillNames[jaName] = "";
      }
      skill.name =
        localName && !localName.startsWith("skill.") ? localName : jaName;

      const tooltipKey = `tooltip.${skill.id}`;
      if (this.$te(tooltipKey)) {
        if (wrapper) {
          wrapper.tooltip = this.$t(tooltipKey);
        } else {
          skill.tooltip = this.$t(tooltipKey);
        }
      }

      return skill;
    }
}
