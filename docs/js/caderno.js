/* =========================================================================
   CADERNO DE CAMPO — comportamento
   JavaScript sem dependências. Tudo degrada: sem JS, o conteúdo continua lá.
   ========================================================================= */

(function () {
  'use strict';

  var calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ *
   * 1. Lanterna — alterna entre coleta diurna e noturna
   * ------------------------------------------------------------------ */

  (function lanterna() {
    var botao = document.getElementById('lanterna');
    var texto = document.getElementById('lanterna-texto');
    if (!botao) return;

    var guardado = null;
    try { guardado = localStorage.getItem('caderno-modo'); } catch (e) { /* sem storage, tudo bem */ }

    function aplicar(modo) {
      var noite = modo === 'noite';
      document.documentElement.setAttribute('data-modo', noite ? 'noite' : 'dia');
      botao.setAttribute('aria-pressed', noite ? 'true' : 'false');
      texto.textContent = noite ? 'Coleta diurna' : 'Coleta noturna';
      var cor = document.querySelector('meta[name="theme-color"]');
      if (cor) cor.setAttribute('content', noite ? '#1a1a17' : '#f1e8d7');
    }

    aplicar(guardado === 'noite' ? 'noite' : 'dia');

    botao.addEventListener('click', function () {
      var novo = document.documentElement.getAttribute('data-modo') === 'noite' ? 'dia' : 'noite';
      aplicar(novo);
      try { localStorage.setItem('caderno-modo', novo); } catch (e) { /* idem */ }
    });
  })();

  /* ------------------------------------------------------------------ *
   * 2. Revelação no scroll
   * ------------------------------------------------------------------ */

  (function surgir() {
    var alvos = document.querySelectorAll('.surge');
    if (!('IntersectionObserver' in window) || calmo) {
      Array.prototype.forEach.call(alvos, function (el) { el.classList.add('visto'); });
      return;
    }
    var olho = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('visto');
        olho.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(alvos, function (el) { olho.observe(el); });
  })();

  /* ------------------------------------------------------------------ *
   * 3. Régua e índice — marcam a seção em que o leitor está
   * ------------------------------------------------------------------ */

  (function bussola() {
    var secoes = ['topo', 'sujeito', 'perfil', 'colecao', 'instrumentos', 'anexos', 'correio'];
    var elementos = secoes.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (!elementos.length || !('IntersectionObserver' in window)) return;

    var links = document.querySelectorAll('.regua a, .indice a');

    function marcar(id) {
      Array.prototype.forEach.call(links, function (a) {
        var href = a.getAttribute('href');
        if (href === '#' + id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }

    var visiveis = {};
    var olho = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { visiveis[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0; });
      var melhor = null, maior = 0;
      secoes.forEach(function (id) {
        if ((visiveis[id] || 0) > maior) { maior = visiveis[id]; melhor = id; }
      });
      if (melhor) marcar(melhor);
    }, { threshold: [0, 0.15, 0.4, 0.7], rootMargin: '-12% 0px -45% 0px' });

    elementos.forEach(function (el) { olho.observe(el); });
  })();

  /* ------------------------------------------------------------------ *
   * 4. Marcadores da figura — A, B, C, D acendem junto com a legenda
   * ------------------------------------------------------------------ */

  (function decifrar() {
    var itens = document.querySelectorAll('.decifra li');
    if (!itens.length) return;

    function acender(marca, ligado) {
      var ponto = document.querySelector('.marcador[data-marca="' + marca + '"]');
      if (ponto) ponto.classList.toggle('aceso', ligado);
    }

    Array.prototype.forEach.call(itens, function (li) {
      var marca = li.getAttribute('data-marca');
      li.addEventListener('mouseenter', function () { acender(marca, true); });
      li.addEventListener('mouseleave', function () { acender(marca, false); });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.marcador'), function (ponto) {
      var marca = ponto.getAttribute('data-marca');
      var li = document.querySelector('.decifra li[data-marca="' + marca + '"]');
      ponto.addEventListener('mouseenter', function () {
        ponto.classList.add('aceso');
        if (li) li.style.background = 'rgba(180,131,42,.14)';
      });
      ponto.addEventListener('mouseleave', function () {
        ponto.classList.remove('aceso');
        if (li) li.style.background = '';
      });
    });
  })();

  /* ------------------------------------------------------------------ *
   * 5. Pontinhos de frequência dos instrumentos
   * ------------------------------------------------------------------ */

  (function instrumentos() {
    var grupos = document.querySelectorAll('.pontinhos');
    Array.prototype.forEach.call(grupos, function (grupo) {
      var nivel = parseInt(grupo.getAttribute('data-nivel'), 10) || 0;
      grupo.setAttribute('role', 'img');
      for (var i = 1; i <= 5; i++) {
        var ponto = document.createElement('i');
        if (i <= nivel) {
          ponto.className = 'cheio';
          ponto.style.setProperty('--atraso', (i * 70) + 'ms');
        }
        grupo.appendChild(ponto);
      }
    });
  })();

  /* ------------------------------------------------------------------ *
   * 6. A gaveta — filtro, carrossel, teclado e arrasto
   * ------------------------------------------------------------------ */

  var gaveta = (function () {
    var trilho = document.getElementById('trilho');
    if (!trilho) return null;

    var fichas = Array.prototype.slice.call(trilho.querySelectorAll('.ficha'));
    var anterior = document.getElementById('anterior');
    var proximo = document.getElementById('proximo');
    var pontos = document.getElementById('pontos');
    var conta = document.getElementById('gaveta-conta');
    var peneira = document.querySelectorAll('.peneira button');
    var ativas = fichas.slice();

    /* posição de uma ficha dentro do conteúdo rolável, sem depender do offsetParent */
    function posicao(ficha) {
      return ficha.getBoundingClientRect().left
        - trilho.getBoundingClientRect().left
        + trilho.scrollLeft;
    }

    /* A ficha "atual" é a primeira encostada na borda esquerda, não a mais
       próxima do centro: centralizar fazia o primeiro clique em "próximo"
       pular a ficha nº 1. */
    function indiceAtual() {
      var x = trilho.scrollLeft;
      if (x >= trilho.scrollWidth - trilho.clientWidth - 4) return ativas.length - 1;
      var melhor = 0, menor = Infinity;
      ativas.forEach(function (f, i) {
        var d = Math.abs(posicao(f) - x);
        if (d < menor) { menor = d; melhor = i; }
      });
      return melhor;
    }

    function irPara(i) {
      var alvo = ativas[Math.max(0, Math.min(ativas.length - 1, i))];
      if (!alvo) return;
      trilho.scrollTo({ left: Math.max(0, posicao(alvo) - 6), behavior: calmo ? 'auto' : 'smooth' });
      /* não espera o debounce do scroll: as setas reagem na hora */
      if (calmo) sincronizar();
      else window.requestAnimationFrame(sincronizar);
    }

    function desenharPontos() {
      pontos.innerHTML = '';
      ativas.forEach(function (f, i) {
        var b = document.createElement('button');
        b.type = 'button';
        var titulo = f.querySelector('h3');
        b.setAttribute('aria-label', 'Ir para ' + (titulo ? titulo.textContent.trim() : 'ficha ' + (i + 1)));
        b.addEventListener('click', function () { irPara(i); });
        pontos.appendChild(b);
      });
      sincronizar();
    }

    function sincronizar() {
      var i = indiceAtual();
      Array.prototype.forEach.call(pontos.children, function (b, j) {
        if (j === i) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
      var fim = trilho.scrollWidth - trilho.clientWidth;
      anterior.disabled = trilho.scrollLeft <= 4;
      proximo.disabled = trilho.scrollLeft >= fim - 4;
    }

    function filtrar(familia) {
      ativas = fichas.filter(function (f) {
        var bate = familia === 'todos' || f.getAttribute('data-familia') === familia;
        f.hidden = !bate;
        return bate;
      });
      conta.textContent = ativas.length + (ativas.length === 1 ? ' ficha' : ' fichas');
      trilho.scrollTo({ left: 0, behavior: 'auto' });
      desenharPontos();
    }

    anterior.addEventListener('click', function () { irPara(indiceAtual() - 1); });
    proximo.addEventListener('click', function () { irPara(indiceAtual() + 1); });

    trilho.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); irPara(indiceAtual() + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); irPara(indiceAtual() - 1); }
      else if (e.key === 'Home') { e.preventDefault(); irPara(0); }
      else if (e.key === 'End') { e.preventDefault(); irPara(ativas.length - 1); }
    });

    var tique;
    trilho.addEventListener('scroll', function () {
      window.clearTimeout(tique);
      tique = window.setTimeout(sincronizar, 90);
    }, { passive: true });

    Array.prototype.forEach.call(peneira, function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(peneira, function (o) { o.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        filtrar(b.getAttribute('data-familia'));
      });
    });

    /* arrastar com o mouse, como quem puxa a gaveta */
    var puxando = false, partiuX = 0, partiuScroll = 0, andou = 0;

    trilho.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      if (e.target.closest('a, button')) return;
      puxando = true; andou = 0;
      partiuX = e.clientX;
      partiuScroll = trilho.scrollLeft;
      trilho.classList.add('arrastando');
    });

    window.addEventListener('pointermove', function (e) {
      if (!puxando) return;
      var d = e.clientX - partiuX;
      andou = Math.abs(d);
      trilho.scrollLeft = partiuScroll - d;
    });

    window.addEventListener('pointerup', function () {
      if (!puxando) return;
      puxando = false;
      trilho.classList.remove('arrastando');
      if (andou > 30) irPara(indiceAtual());
      else sincronizar();
    });

    window.addEventListener('resize', function () { sincronizar(); });

    desenharPontos();
    window.setTimeout(sincronizar, 200);

    return { irPara: irPara, filtrar: filtrar };
  })();

  /* ------------------------------------------------------------------ *
   * 7. A lupa — ficha completa de cada espécime
   * ------------------------------------------------------------------ */

  var acervo = {
    insetos: {
      tombo: 'ESP-005 · família pessoal · 2.º sem. 2026',
      nome: 'Insetos vs Zumbis',
      binomial: 'Formica bellatrix vectorialis',
      pranchas: [
        ['assets/img/insetos-banner.png', 'Banner gerado pela própria arte do jogo'],
        ['assets/img/insetos-2.png', 'Mundo noturno — quarta fileira sob ataque'],
        ['assets/img/insetos-3.png', 'Aracne, a chefe final do Coração da Colônia'],
        ['assets/img/insetos-1.png', 'Arena de jardim — abelhas produzindo néctar']
      ],
      sobre: 'Um tower-defense no espírito de Plants vs Zombies: a colônia de insetos segura a horda de bichos de jardim apodrecidos ao longo de 50 fases, 5 mundos e 5 chefões. Feito em Flutter com a engine Flame, distribuído como APK Android.',
      contribuicao: 'Projeto solo, do primeiro rascunho ao APK. A decisão que define o projeto foi não usar nenhum arquivo de imagem: toda a arte é função vetorial desenhada no Canvas do Flutter, quadro a quadro, via CustomPainter — inclusive o banner do repositório, que é gerado por um script que roda a própria arte do jogo. Arquitetei o sistema para crescer sem inchar: fase é dado (LevelConfig e WaveConfig), não código, e cada defensor ou inimigo é uma subclasse de uma base comum, com o desenho num arquivo e o comportamento em outro. Escrevi 75 testes cobrindo game loop, economia de néctar, progressão de ondas e regras dos modos alternativos.',
      itens: [
        '50 fases distribuídas em 5 mundos, com 5 chefões',
        '12 insetos defensores, cada um com um papel de combate',
        'Arte 100 % vetorial: zero sprites, zero imagens externas',
        'Modos além da campanha, minijogos e meta-game com jardim e almanaque',
        '75 testes automatizados com flame_test',
        'Áudio com AudioPool — players reaproveitados, sem vazamento'
      ],
      habitat: ['Flutter', 'Dart', 'Flame 1.37', 'Canvas / CustomPainter', 'flame_audio', 'shared_preferences', 'flame_test'],
      links: [['Repositório', 'https://github.com/Raflael/insetos-vs-zumbis']]
    },

    foiaqui: {
      tombo: 'ESP-004 · família pessoal · 1.º sem. 2026',
      nome: 'FoiAqui',
      binomial: 'Memoria urbana geolocata',
      vertical: true,
      pranchas: [
        ['assets/img/foiaqui-1.png', 'Mapa com pins em forma de placa esmaltada'],
        ['assets/img/foiaqui-2.png', 'Ficha da memória em bottom sheet, com slider passado ↔ presente'],
        ['assets/img/foiaqui-3.png', 'Trilhas — memórias encadeadas em percurso']
      ],
      sobre: 'A memória de uma cidade some junto com quem viveu nela. O FoiAqui liga o lugar à história no ponto exato em que ela aconteceu: qualquer pessoa contribui com foto, relato, áudio ou vídeo, e a comunidade modera. Cidade-piloto: São José dos Campos.',
      contribuicao: 'Projeto solo, do problema ao APK. Conduzi a pesquisa de UX pela metodologia do Duplo Diamante — benchmarking, personas e Business Model Canvas — e depois traduzi cada decisão de pesquisa em código, em vez de deixar o estudo morrer na planilha. Desenhei a identidade visual "Placa Esmaltada" e validei os 29 pares de cor no WCAG AA, um a um. Semeei o acervo com memórias reais, de 1865 a 2021, cada uma com coordenada do OpenStreetMap e fonte pública declarada na ficha. E deixei dois dos dez lugares sem memória nenhuma, de propósito: o mapa precisa mostrar onde falta registro, não só onde já tem.',
      itens: [
        'Mapa com pins que se agrupam quando ficariam empilhados',
        'Ficha em bottom sheet com slider comparando passado e presente',
        'Quatro portas de contribuição: foto, relato escrito, áudio e vídeo',
        'Moderação comunitária das contribuições',
        'Acervo real: 12 memórias de 1865 a 2021, com fonte declarada',
        '29 de 29 pares de cor aprovados no WCAG AA'
      ],
      habitat: ['React Native 0.86', 'Expo SDK 57', 'TypeScript', 'Expo Router', 'Reanimated 4', 'Zustand', 'react-native-maps', 'expo-camera', 'expo-audio'],
      links: [['Repositório', 'https://github.com/Raflael/foiaqui']]
    },

    crm: {
      tombo: 'ESP-003 · família acadêmico · ABP 3DSM · 1.º sem. 2026',
      nome: 'DevFlow CRM',
      binomial: 'Mercator digitalis vallensis',
      diagramas: true,
      pranchas: [
        ['assets/img/abp3-4.png', 'Sequência: login e emissão do token JWT'],
        ['assets/img/abp3-2.png', 'Sequência: criação de lead, da validação de perfil ao log'],
        ['assets/img/abp3-1.png', 'Sequência: dashboard da equipe, com checagem de papel'],
        ['assets/img/abp3-3.png', 'Sequência: atualização de estágio da negociação']
      ],
      notaPrancha: 'O repositório do projeto não publica capturas das telas — elas só existem com o sistema em execução. O que dá para mostrar aqui é a modelagem que sustenta o front que eu construí.',
      sobre: 'Plataforma para centralizar, gerenciar e analisar os leads comerciais da 1000 Valle Multimarcas, revendedora de veículos com múltiplas unidades. O sistema junta canais presenciais e digitais numa interface só e entrega visibilidade do funil para todos os níveis da hierarquia.',
      contribuicao: 'Atuei como desenvolvedor front-end da equipe DevFlow. Construí o dashboard analítico e seus gráficos, incluindo o ranking de atendentes, e reestruturei a página de leads em abas, com busca em tempo real e filtros resolvidos no cliente para a lista responder na hora. Fiz as telas de permissões, perfis e usuários — e, junto delas, o controle de acesso por capabilities no front, que decide o que cada um dos quatro perfis enxerga na interface. Também implementei a persistência das preferências de filtro e o fluxo de negociação com o modal de fechamento.',
      itens: [
        '7 módulos e 4 perfis de acesso hierárquicos',
        'Dashboard analítico em tempo real, com ranking de atendentes',
        'Controle de acesso por capabilities, com JWT no back',
        'Logs de auditoria — rastreabilidade de todas as ações',
        'Suporte a múltiplas lojas e múltiplas equipes',
        '3 sprints planejadas em Poker Planning, acompanhadas por burndown'
      ],
      habitat: ['React 18', 'TypeScript', 'Vite', 'TailwindCSS', 'Node.js 20', 'Express', 'Prisma', 'PostgreSQL 16', 'Docker Compose'],
      links: [['Repositório', 'https://github.com/prjDevflow/prj_3dsm']]
    },

    analytics: {
      tombo: 'ESP-002 · família acadêmico · ABP 2DSM · 2.º sem. 2025',
      nome: 'Devflow Analytics',
      binomial: 'Limnodata reservatorii',
      pranchas: [
        ['assets/img/abp2-1.png', 'Protótipo do painel: mapa do reservatório, filtros e tabela'],
        ['assets/img/abp2-2.png', 'Protótipo do portal de entrada, nas quatro variações testadas']
      ],
      sobre: 'Plataforma para centralizar, visualizar e disponibilizar os dados limnológicos e meteorológicos do projeto de Balanço de Carbono nos Reservatórios de Furnas Centrais Elétricas, em cooperação com INPE, UFRJ, UFJF e IIE. Junta dados de campanhas de campo com a coleta automática do sistema SIMA, do INPE.',
      contribuicao: 'Fui o Product Owner do projeto. Meu trabalho foi traduzir a necessidade científica — que chegava na linguagem dos pesquisadores — em requisitos que o time conseguisse executar dentro da sprint, e priorizar o backlog para que o que era essencial saísse primeiro. Conduzi as decisões de escopo e arquitetura junto com os desenvolvedores, acompanhei a evolução das entregas e mantive o canal com os stakeholders aberto do começo ao fim, para garantir que o mapa interativo, as tabelas filtradas e os gráficos de séries temporais refletissem o que a pesquisa realmente precisava — e não o que era mais confortável de construir.',
      itens: [
        'Painel interativo com filtro por instituição, reservatório e período',
        'Tabelas dinâmicas com paginação e ordenação sobre dados brutos',
        'Exportação em CSV dos conjuntos filtrados, com metadados',
        'Mapa interativo dos pontos de coleta, com clusterização',
        'Gráficos de séries temporais sobre os dados do SIMA'
      ],
      habitat: ['React', 'TypeScript', 'MUI', 'Node.js', 'Express', 'PostgreSQL', 'Docker'],
      links: [['Repositório', 'https://github.com/prjDevflow/prj_2dsm']]
    },

    horarios: {
      tombo: 'ESP-001 · família acadêmico · ABP 1DSM · 1.º sem. 2025',
      nome: 'Horários Fatec',
      binomial: 'Tabula horaria fatecensis',
      pranchas: [
        ['assets/img/abp1-1.png', 'O sistema no ar: escolha do curso para consultar a grade'],
        ['assets/img/abp1-2.png', 'Protótipo no Figma que originou a interface']
      ],
      sobre: 'Site responsivo para consulta da grade horária dos cursos da Fatec Jacareí. Aluno, professor e secretaria chegam ao mesmo dado por caminhos diferentes — cada um com a visão que precisa. Foi o primeiro projeto integrador do curso, e o primeiro código meu a ser usado por alguém de fora do time.',
      contribuicao: 'Respondi pelo design e pela frente de front-end. Criei o protótipo inicial no Figma, onde defini a identidade visual e o fluxo de navegação, e depois voltei para revisar a estética das primeiras páginas já implementadas, aparando as inconsistências que aparecem quando várias pessoas escrevem CSS ao mesmo tempo. Reestruturei o mapa do site e programei por inteiro a área da secretaria, com as funcionalidades específicas daquele setor. Na fase final, assumi o JavaScript das interações dinâmicas e das melhorias de usabilidade.',
      itens: [
        'Layout responsivo para celular e desktop',
        'Consulta de horários por turma ou por professor',
        'Busca integrada na listagem',
        'Área dedicada à secretaria',
        'Protótipo completo no Figma antes de uma linha de código'
      ],
      habitat: ['HTML5', 'CSS3', 'JavaScript', 'SQL', 'Figma'],
      links: [
        ['Repositório', 'https://github.com/prjDevflow/prj_1sem_client'],
        ['Projeto no ar', 'https://prj-1sem-client.vercel.app/']
      ]
    }
  };

  (function lupa() {
    var caixa = document.getElementById('lupa');
    var folha = caixa ? caixa.querySelector('.lupa__folha') : null;
    var conteudo = document.getElementById('lupa-conteudo');
    var fechar = document.getElementById('lupa-fechar');
    if (!caixa || !conteudo) return;

    var devolverFoco = null;
    var limpeza = null;

    function esc(t) {
      return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function montar(d) {
      var html = '';

      html += '<div class="lupa__cabeca">';
      html += '<span class="rotulo">' + esc(d.tombo) + '</span>';
      html += '<h3 id="lupa-titulo">' + esc(d.nome) + '</h3>';
      html += '<p class="ficha__binomial">' + esc(d.binomial) + '</p>';
      html += '</div>';

      if (d.pranchas.length) {
        html += '<div class="lupa__galeria' + (d.vertical ? ' lupa__galeria--alta' : '') +
        (d.diagramas ? ' lupa__galeria--diagrama' : '') + '">';
        d.pranchas.forEach(function (p) {
          html += '<figure><img src="' + esc(p[0]) + '" loading="lazy" alt="' + esc(p[1]) + '">';
          html += '<figcaption>' + esc(p[1]) + '</figcaption></figure>';
        });
        html += '</div>';
        if (d.notaPrancha) html += '<p class="nota-prancha">' + esc(d.notaPrancha) + '</p>';
      }

      html += '<div class="lupa__colunas"><div>';
      html += '<h4>Sobre o espécime</h4><p>' + esc(d.sobre) + '</p>';
      html += '<h4>Observações do coletor — minha contribuição</h4><p>' + esc(d.contribuicao) + '</p>';
      html += '</div><div>';

      html += '<h4>O que existe</h4><ul class="marcas">';
      d.itens.forEach(function (i) { html += '<li>' + esc(i) + '</li>'; });
      html += '</ul>';

      html += '<h4>Habitat técnico</h4><div class="etiquetas">';
      d.habitat.forEach(function (t) { html += '<span>' + esc(t) + '</span>'; });
      html += '</div></div></div>';

      if (d.links.length) {
        html += '<div class="lupa__pe">';
        d.links.forEach(function (l, i) {
          html += '<a class="btn' + (i ? ' btn--vazado' : '') + '" href="' + esc(l[1]) +
            '" target="_blank" rel="noopener">' + esc(l[0]) + '</a>';
        });
        html += '</div>';
      }

      conteudo.innerHTML = html;
    }

    function abrir(chave, origem) {
      var d = acervo[chave];
      if (!d) return;
      window.clearTimeout(limpeza);
      devolverFoco = origem || null;
      montar(d);
      caixa.hidden = false;
      /* dois quadros para o navegador aplicar a transição */
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { caixa.classList.add('aberta'); });
      });
      document.body.style.overflow = 'hidden';
      folha.scrollTop = 0;
      fechar.focus();
    }

    function sair() {
      caixa.classList.remove('aberta');
      document.body.style.overflow = '';
      limpeza = window.setTimeout(function () {
        caixa.hidden = true;
        conteudo.innerHTML = '';
      }, calmo ? 0 : 320);
      if (devolverFoco) devolverFoco.focus();
      devolverFoco = null;
    }

    document.addEventListener('click', function (e) {
      var gatilho = e.target.closest('[data-lupa]');
      if (gatilho) { abrir(gatilho.getAttribute('data-lupa'), gatilho); return; }
      if (e.target === caixa) sair();
    });

    fechar.addEventListener('click', sair);

    document.addEventListener('keydown', function (e) {
      if (caixa.hidden) return;
      if (e.key === 'Escape') { sair(); return; }
      if (e.key !== 'Tab') return;

      var focaveis = folha.querySelectorAll('a[href], button:not([disabled])');
      if (!focaveis.length) return;
      var primeiro = focaveis[0];
      var ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    });
  })();

})();
