window.focus(); // переводим фокус на окно игры
let camera, scene, renderer; // обьявляем переменные для библиотеки Three.js
let world; // обьявляем переменную для библиотеки CannonJs
let lastTime; //время последней анимации
let stack; // в массиве храним часть пирамиды, котрые уже стоят друг на друге
let overhangs; // часть блоков, которые падают
const boxHeight = 1; //высота каждого блока
const originalBoxSize = 3; // начальная ширина и глубина блоков
let autopilot; // переменная для игры на автопилоте
let gameEnded; // переменная для окончания игры
let robotPrecision; //переменная отвечающая за точность игры
//получение доступа к странице с разделами (очки, инструкция, результат)
const scoreElement = document.getElementById("score");
const instructionElement = document.getElementById("instruction");
const resultElement = document.getElementById("result");
var muz = new Audio();
var szmak = new Audio();
muz.src = "pir.mp3";
szmak.src = "sss.mp3";

// функция добавления нового слоя
function addLayer(x, z, width, depth, direction) {
  const y = boxHeight * stack.length; // получаем высоту нового слоя, на котором буде работать
  const layer = generateBox(x, y, z, width, depth, false); //создаем новый слой
  layer.direction = direction; // устанавливаем направление движения
  stack.push(layer); // добавляем в массив с слоями (пирамидой) новый слой
}
// отрисовка блока
function generateBox(x, y, z, width, depth, falls) {
  const geometry = new THREE.BoxGeometry(width, boxHeight, depth); // создаем параллелограмм
  const color = new THREE.Color(`hsl(${30 + stack.length * 4},100%,50%)`); //создаем цвет для каждого уровня и коробки
  const material = new THREE.MeshLambertMaterial({ color }); // создаем материал
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z); // указываем позицию
  scene.add(mesh); //добавляем коробку на сцену
  // применяем физику движка Cannon.js
  const shape = new CANNON.Box(
    new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2)
  ); //создаем виртуальный блок внутри коробки
  let mass = falls ? 5 : 0; // смотрим  по входным параметрам падает или не падает блок
  //уменьшение блока пропорционально его размерам
  mass = width / originalBoxSize;
  mass = depth / originalBoxSize;
  const body = new CANNON.Body({ mass, shape }); //создаем новую фигуру на основе блока
  body.position.set(x, y, z); //помещаем в нужное место (исходную позицию)
  world.addBody(body); // добавляет фигуру в физическое виртуальное пространство
  return {
    threejs: mesh,
    cannonjs: body,
    width,
    depth,
  };
}
//рисование падающего блока
function addOverhang(x, z, width, depth) {
  const y = boxHeight * (stack.length - 1); //получаем высоту на которой стоял верхний блок
  const overhang = generateBox(x, y, z, width, depth, true); //создаем новую фигуру
  overhangs.push(overhang); //добавляем падающий блок в множество всех упавших блоков
}

//функция обрезания блоков
function cutBox(topLayer, overlap, size, delta) {
  const direction = topLayer.direction; // определяем направление в котором проводим обрезание
  const newWidth = direction == "x" ? overlap : topLayer.width; //формируем новую ширину
  const newDepth = direction == "z" ? overlap : topLayer.depth; //формируем новую глубину

  //обновление параметров верхнего блока
  topLayer.width = newWidth;
  topLayer.depth = newDepth;

  //обновляем верхний блок в THREEJS
  topLayer.threejs.scale[direction] = overlap / size;
  topLayer.threejs.position[direction] -= delta / 2;

  //обновляем верхний блок в Cannonjs
  topLayer.cannonjs.position[direction] -= delta / 2;

  //заменяем верхний блок меньшим, обрезанным блоком
  const shape = new CANNON.Box(
    new CANNON.Vec3(newWidth / 2, boxHeight / 2, newDepth / 2)
  );
  // добавляем обрезанную часть фигуры в физическую модель
  topLayer.cannonjs.shape = [];
  topLayer.cannonjs.addShape(shape);
}
//возвращаем полигонные сетки и физические характеристики объекта

function init() {
  autopilot = true; //включаем автопилот
  muz.play();
  gameEnded = false; //игра не закончилась
  lastTime = 0; // начальное время
  stack = []; // нет уровней
  overhangs = []; // нет падающих деталей
  robotPrecision = Math.random() * 1 - 0.5; // точность в автопилоте
  const aspect = window.innerWidth / window.innerHeight;
  const width = 10;
  const height = width / aspect;

  camera = new THREE.OrthographicCamera(
    width / -2,
    width / 2,
    height / 2,
    height / -2,
    1,
    100
  );
  camera.position.set(4, 4, 4);
  camera.lookAt(0, 0, 0);
  //запускаем движок CANNON.JS

  world = new CANNON.World();
  world.gravity.set(0, -10, 0); // формируем гравитацию
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 40;

  //создаем сцену
  scene = new THREE.Scene();
  addLayer(0, 0, originalBoxSize, originalBoxSize); // основание пирамиды
  addLayer(-10, 0, originalBoxSize, originalBoxSize, "x"); // первый слой пирамиды
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // фоновая подсветка сцены
  scene.add(ambientLight);
  const directLight = new THREE.DirectionalLight(0xffffff, 0.6); // прямой свет на пирамиду
  directLight.position.set(5, 10, 0);
  scene.add(directLight);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  renderer.render(scene, camera);
  renderer.setAnimationLoop(animation);
}

init();

//функция запуска игры
function startGame() {
  autopilot = false; // отключаю режим автопилота (режим меню)
  gameEnded = false; // сбрасываем настройку "окончание игры"
  muz.pause();
  lastTime = 0; // начальное время
  stack = []; // нет уровней
  overhangs = []; // нет падающих деталей
  // если на єкране присутствует инструкция или результат то надо его скрыть
  if (instructionElement) instructionElement.style.display = "none";
  if (resultElement) resultElement.style.display = "none";
  // если количество очков не равно нулю, обнуляем их
  if (scoreElement) scoreElement.innerText = 0;
  // убираем весь мир CANNON JS со сцены

  if (world) {
    while (world.bodies.length > 0) {
      world.remove(world.bodies[0]);
    }
  }

  if (scene) {
    while (scene.children.find((c) => c.type == "Mesh")) {
      const mesh = scene.children.find((c) => c.type == "Mesh");
      scene.remove(mesh);
    }
  }

  addLayer(0, 0, originalBoxSize, originalBoxSize); // основание пирамиды
  addLayer(-10, 0, originalBoxSize, originalBoxSize, "x"); // первый слой пирамиды

  if (camera) {
    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);
  }
}

//отслеживаем нажатия на клавиатуру и мышь

if (
  /Android|iPhone|webOS|iPad|iPod|BlackBerry|IEMobile|Windows Phone|IOS/i.test(
    navigator.userAgent
  )
) {
  window.addEventListener("touchstart", eventHandler);
  window.addEventListener("touchmove", startGame);
} else {
  window.addEventListener("mousedown", eventHandler);
}

// // обрабатываем нажатие мыши
// window.addEventListener("mousedown", eventHandler);
// // обрабатываем касание экрана
// window.addEventListener("touchstart", eventHandler);

window.addEventListener("keydown", function (event) {
  // если нажать пробел
  if (event.key == " ") {
    event.preventDefault(); //отключаем все встроенные обработчики событий в браузере
    eventHandler();
    return;
  }
  //если нажать клавишу R
  if (
    event.key == "R" ||
    event.key == "r" ||
    event.key == "К" ||
    event.key == "к"
  ) {
    event.preventDefault(); //отключаем все встроенные обработчики событий в браузере
    startGame();
    return;
  }
});

function eventHandler() {
  if (autopilot)
    startGame(); // если был режим "Инструкция" то нажатие мышки запускает игру
  else fix_Block_on_Piramid(); // иначе запускаем функцию "Фиксация блока в пирамиде"
}
//функция которая отвечает за разделение слоев
function fix_Block_on_Piramid() {
  // если игра закончилась — выходим из функции
  if (gameEnded) return;

  // берём верхний блок и тот, что под ним
  const topLayer = stack[stack.length - 1];
  const previousLayer = stack[stack.length - 2];

  // направление движения блока
  const direction = topLayer.direction;

  // если двигались по оси X, то берём ширину блока, а если нет (по оси Z) — то глубину
  const size = direction == "x" ? topLayer.width : topLayer.depth;
  // считаем разницу между позициями этих двух блоков
  const delta =
    topLayer.threejs.position[direction] -
    previousLayer.threejs.position[direction];
  // считаем размер свеса
  const overhangSize = Math.abs(delta);
  // размер отрезаемой части
  const overlap = size - overhangSize;

  // если есть что отрезать (если есть свес)
  if (overlap > 0) {
    // отрезаем
    cutBox(topLayer, overlap, size, delta);
    szmak.play();

    // считаем размер свеса
    const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
    // если обрезка была по оси X
    const overhangX =
      direction == "x"
        ? topLayer.threejs.position.x + overhangShift
        : topLayer.threejs.position.x;
    // если обрезка была по оси Z
    const overhangZ =
      direction == "z"
        ? // то добавляем размер свеса к начальным координатам по этой оси
          topLayer.threejs.position.z + overhangShift
        : topLayer.threejs.position.z;
    // если свес был по оси X, то получаем ширину, а если по Z — то глубину
    const overhangWidth = direction == "x" ? overhangSize : topLayer.width;
    const overhangDepth = direction == "z" ? overhangSize : topLayer.depth;

    // рисуем новую фигуру после обрезки, которая будет падать вних
    addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);

    // формируем следующий блок
    // отодвигаем их подальше от пирамиды на старте
    const nextX = direction == "x" ? topLayer.threejs.position.x : -10;
    const nextZ = direction == "z" ? topLayer.threejs.position.z : -10;
    // новый блок получает тот же размер, что и текущий верхний
    const newWidth = topLayer.width;
    const newDepth = topLayer.depth;
    // меняем направление относительно предыдущего
    const nextDirection = direction == "x" ? "z" : "x";

    // если идёт подсчёт очков — выводим текущее значение
    if (scoreElement) scoreElement.innerText = stack.length - 1;
    // добавляем в сцену новый блок
    addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);
    // если свеса нет и игрок полностью промахнулся мимо пирамиды
  } else {
    // обрабатываем промах
    missed_The_Spot();
  }
}

//обработка промаха
function missed_The_Spot() {
  const topLayer = stack[stack.length - 1]; // задаем номер верхнего блока
  addOverhang(
    topLayer.threejs.position.x,
    topLayer.threejs.position.z,
    topLayer.width,
    topLayer.depth
  ); //формирует полностью падающий блок
  world.remove(topLayer.cannonjs);
  scene.remove(topLayer.threejs);
  gameEnded = true;
  muz.play();
  if (resultElement && !autopilot) resultElement.style.display = "flex";
}

function animation(time) {
  // если прошло сколько-то времени с момента прошлой анимации
  if (lastTime) {
    // считаем, сколько прошло
    const timePassed = time - lastTime;
    // задаём скорость движения
    const speed = 0.008;
    // берём верхний и предыдущий слой
    const topLayer = stack[stack.length - 1];
    const previousLayer = stack[stack.length - 2];

    // верхний блок должен двигаться
    // ЕСЛИ не конец игры
    // И это не автопилот
    // ИЛИ это всё же автопилот, но алгоритм ещё не довёл блок до нужного места
    const boxShouldMove =
      !gameEnded &&
      (!autopilot ||
        (autopilot &&
          topLayer.threejs.position[topLayer.direction] <
            previousLayer.threejs.position[topLayer.direction] +
              robotPrecision));
    // если верхний блок должен двигаться
    if (boxShouldMove) {
      // двигаем блок одновременно в сцене и в физическом мире
      topLayer.threejs.position[topLayer.direction] += speed * timePassed;
      topLayer.cannonjs.position[topLayer.direction] += speed * timePassed;

      // если блок полностью улетел за пирамиду
      if (topLayer.threejs.position[topLayer.direction] > 10) {
        // обрабатываем промах
        missed_The_Spot();
      }
      // если верхний блок двигаться не должен
    } else {
      // единственная ситуация, когда это возможно, это когда автопилот только-только поставил блок на место
      // в этом случае обрезаем лишнее и запускаем следующий блок
      if (autopilot) {
        fix_Block_on_Piramid();
        robotPrecision = Math.random() * 1 - 0.5;
      }
    }

    // после установки блока поднимаем камеру
    if (camera.position.y < boxHeight * (stack.length - 2) + 4) {
      camera.position.y += speed * timePassed;
    }
    updatePhysics(timePassed);
    renderer.render(scene, camera);
  }
  // ставим текущее время как время последней анимации
  lastTime = time;
}
// обновляем физические изменения и визуализируем их
function updatePhysics(timePassed) {
  world.step(timePassed / 1000);
  overhangs.forEach((element) => {
    element.threejs.position.copy(element.cannonjs.position);
    element.threejs.quaternion.copy(element.cannonjs.quaternion);
  });
}
// адаптируем картинку к размерам єкрана
window.addEventListener("resize", () => {
  //выравниваем положение камеры
  // получить новый размер и поставить камеру пропорционально новому размеру
  const aspect = window.innerWidth / window.innerHeight;
  const width = 30;
  const height = width / aspect;
  camera.top = height;
  camera.bottom = -height;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
});
