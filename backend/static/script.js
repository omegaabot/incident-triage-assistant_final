document.addEventListener('DOMContentLoaded', function() {
  // Sidebar toggle
  var toggle = document.getElementById('sidebar-toggle');
  var sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', function() {
      sidebar.classList.toggle('sidebar--collapsed');
    });
  }

  // Rule card expand/collapse
  document.querySelectorAll('.rule-card-header').forEach(function(header) {
    header.addEventListener('click', function() {
      var card = this.closest('.rule-card');
      var chevron = this.querySelector('.rule-chevron');
      card.classList.toggle('expanded');
      if (chevron) chevron.classList.toggle('open');
      var expanded = card.querySelector('.rule-expanded');
      if (expanded) {
        expanded.style.display = expanded.style.display === 'none' ? '' : 'none';
      }
    });
  });

  // Tab switching
  document.querySelectorAll('.report-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var tabs = this.closest('.report-tabs').querySelectorAll('.report-tab');
      tabs.forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      var target = this.getAttribute('data-tab');
      document.querySelectorAll('.tab-content').forEach(function(c) {
        c.style.display = c.id === target ? 'block' : 'none';
      });
    });
  });

  // Checklist toggle
  document.querySelectorAll('.checklist-checkbox').forEach(function(cb) {
    cb.addEventListener('click', function() {
      this.classList.toggle('checked');
      var item = this.closest('.checklist-item');
      if (item) item.classList.toggle('done');
    });
  });

  // History item click
  document.querySelectorAll('.history-item').forEach(function(item) {
    item.addEventListener('click', function(e) {
      if (e.target.tagName === 'A') return;
      var link = this.getAttribute('data-href');
      if (link) window.location.href = link;
    });
  });
});
