const Vue = require("vue");
const MixinRaceCore = require("./uma-clock-emu-source/src/components/MixinRaceCore.vue").default;
const MixinSkills = require("./uma-clock-emu-source/src/components/MixinSkills.vue").default;
const MixinPositionKeeping = require("./uma-clock-emu-source/src/components/MixinPositionKeeping.vue").default;
const courseData = require("./uma-clock-emu-source/src/components/data/course_data.json");
const skillData = require("./uma-clock-emu-source/src/components/data/skill_data.json");

Vue.config.productionTip = false;
const Comp = Vue.extend({
  mixins: [MixinRaceCore, MixinSkills, MixinPositionKeeping],
  template: "<div></div>",
  data() { return { 
      emulatorType: "team",
      track: { location: "10008", course: "10811", surfaceCondition: "1" },
      umaStatus: { speed: 1000, stamina: 1500, power: 900, guts: 1200, wisdom: 1000, condition: 0, style: 4, distanceFit: "A", surfaceFit: "A", styleFit: "S" },
      skillDataRaw: skillData,
      trackData: courseData,
      skills: []
  }; },
  methods: { $t: (key) => key }
});

const vm = new Comp().$mount();
vm.passiveBonus = { speed: 0, stamina: 0, power: 0, guts: 0, wisdom: 0, temptationRate: 0 };
vm.skillActivateAdjustment = "expected";
vm.$refs = { executeBlock: { skillActivateAdjustment: "expected", epoch: 0 } };
vm.types = [];
vm.passiveBonusKeys = ["speed", "stamina", "power", "guts", "wisdom", "temptationRate"];
vm.operatingSkills = [];
vm.condCoef = { 0: 1.04, 1: 1.02, 2: 1, 3: 0.98, 4: 0.96 };
vm.fixRandom = false;
vm.useExpectedValue = true;
vm.oonige = false;
vm.updateChart = () => {};
vm.updateSelfSpeedChart = () => {};
vm.updateSpChart = () => {};

vm.resetRace();
vm.initCondition();
vm.initClimate();
vm.initCourse();
vm.invokeSkills("expected");
vm.startDelay = 0.05;
vm.triggerStartSkills();
vm.initSystematicSkills();
vm.initTemptation();
vm.isStartDash = true;
vm.delayTime = 0.05;
vm.sp = vm.spMax;
vm.sectionTargetSpeedRandoms = vm.initSectionTargetSpeedRandoms();

for (let i = 0; i < 280; i++) {
  vm.progressEpoch();
  let ts = vm.targetSpeed;
  if (i >= 270) {
    console.log(`[Frame ${i}] pos=${vm.position}, ts=${ts}, spd=${vm.currentSpeed}`);
  }
  let ssp = vm.sp;
  let spd = vm.currentSpeed;
  let pos = vm.position;
  vm.progressSelfSpeed();
  vm.progressPosition();
  vm.sp -= vm.consumePerSecond(vm.isStartDash ? spd : vm.baseSpeed, spd, vm.currentPhase) / 15.0;
  vm.frameElapsed++;
}
