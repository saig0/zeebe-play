var bpmnViewIsLoaded = false;

function getProcessInstanceKey() {
  return $("#process-instance-page-key").text();
}

function loadProcessInstanceView() {
  const processInstanceKey = getProcessInstanceKey();

  queryProcessInstance(processInstanceKey)
      .done(function (response) {
        let processInstance = response.data.processInstance;
        let process = processInstance.process;

        $("#process-instance-key").text(processInstance.key);
        $("#process-instance-start-time").text(processInstance.startTime);

        let endTime = "-";
        if (processInstance.endTime) {
          endTime = processInstance.endTime;
        }

        $("#process-instance-end-time").text(endTime);

        let state = "";
        switch (processInstance.state) {
          case "ACTIVATED":
            state = '<span class="badge bg-primary">active</span>';
            break;
          case "COMPLETED":
            state = '<span class="badge bg-secondary">completed</span>';
            break;
          case "TERMINATED":
            state = '<span class="badge bg-dark">terminated</span>';
            break;
          default:
            state = "?"
        }

        if (processInstance.incidents.length > 0) {
          state += ' <span class="badge bg-danger">incidents</span>';
        }

        $("#process-instance-state").html(state);

        $("#process-page-key").html(
            '<a href="/view/process/' + process.key + '">'
            + process.key
            + '</a>'
            + ' <span class="text-muted">(' + process.bpmnProcessId + ')</span>'
        );

        if (!bpmnViewIsLoaded) {
          const bpmnXML = process.bpmnXML;
          showBpmn(bpmnXML);

          bpmnViewIsLoaded = true;
        }
      });

  loadVariablesOfProcessInstance();
  loadElementInstancesOfProcessInstance();
}

function loadVariablesOfProcessInstance() {

  const processInstanceKey = getProcessInstanceKey();

  queryVariablesByProcessInstance(processInstanceKey)
      .done(function (response) {

        let processInstance = response.data.processInstance;
        let variables = processInstance.variables;

        let totalCount = variables.length;

        $("#variables-total-count").text(totalCount);

        $("#variables-of-process-instance-table tbody").empty();

        const indexOffset = 1;

        variables.forEach((variable, index) => {

          let scope = variable.scope;
          let scopeFormatted = scope.elementId;
          if (scope.elementName) {
            scopeFormatted = scope.elementName;
          }
          if (scope.bpmnElementType == 'PROCESS') {
            scopeFormatted = '<span class="badge bg-primary">global</span>';
          } else {
            scopeFormatted += ' <button type="button" class="btn btn-sm btn-outline-light" title="Highlight element" onclick="highlightElement(\'' + scope.elementId + '\');">'
                + '<svg class="bi" width="18" height="18"><use xlink:href="/img/bootstrap-icons.svg#geo-alt"/></svg>'
                + '</button>'
                + ' <span class="badge bg-secondary">local</span>';
          }

          let valueFormatted = '<code>' + variable.value + '</code>';

          let lastUpdatedFormatted = '<div class="row row-cols-1">'
              + '<div class="col">'
              + variable.timestamp;

          let variableUpdatesId = 'variable-updates-' + variable.key;

          if (variable.updates.length > 1) {
            lastUpdatedFormatted += ' <span class="badge bg-secondary">modified</span>'
                + ' <button type="button" class="btn btn-sm btn-outline-light" data-bs-toggle="collapse" href="#' + variableUpdatesId + '" aria-expanded="false">'
                + '<svg class="bi" width="18" height="18"><use xlink:href="/img/bootstrap-icons.svg#eye"/></svg>'
                + '</button>';
          }

          lastUpdatedFormatted += "</div>"

          if (variable.updates.length > 1) {

            let variableUpdates = '<table class="table">'
                + '<thead>'
                + '<tr>'
                + '<th scope="col">Value</th>'
                + '<th scope="col">Update Time</th>'
                + '</tr>'
                + '</thead>'
                + '<tbody>';

            variable.updates.forEach((update) => {
              variableUpdates += '<tr>'
                  + '<td><code>' + update.value + '</code></td>'
                  + '<td>' + update.timestamp +'</td>'
                  + '</tr>';
            });

            variableUpdates += '</tbody></table>';

            lastUpdatedFormatted += '<div class="collapse" id="' + variableUpdatesId + '">'
                + '<div class="col">'
                + variableUpdates
                + '</div>'
                + '</div>';
          }

          lastUpdatedFormatted += '</div>';

          let fillModalAction = 'fillSetVariablesModal(\''
              + scope.key + '\', \''
              + variable.name + '\', \''
              + variable.value.replace(/"/g, '&quot;')
              + '\');';

          let actionButton = '<button type="button" class="btn btn-sm btn-primary" data-bs-toggle="modal" data-bs-target="#set-variable-modal" title="Edit" onclick="'+ fillModalAction + '">'
              + '<svg class="bi" width="18" height="18" fill="white"><use xlink:href="/img/bootstrap-icons.svg#pencil"/></svg>'
              + '</button>';

          $("#variables-of-process-instance-table > tbody:last-child").append('<tr>'
              + '<td>' + (indexOffset + index) +'</td>'
              + '<td>' + variable.name + '</td>'
              + '<td>' + valueFormatted +'</td>'
              + '<td>' + scopeFormatted +'</td>'
              + '<td>' + scope.key +'</td>'
              + '<td>' + lastUpdatedFormatted +'</td>'
              + '<td>' + actionButton +'</td>'
              + '</tr>');

        });

      });
}

function fillSetVariablesModal(scopeKey, variableName, variableValue) {
  let scope = scopeKey;
  if (scopeKey === getProcessInstanceKey()) {
    scope = 'global';
  }
  $("#variablesScope").val(scope);

  let variables = '{"' + variableName + '": ' + variableValue + '}';
  $("#updatedVariables").val(variables);
}

function setVariablesModal() {
  let scope = $("#variablesScope").val();
  if (scope === 'global') {
    scope = getProcessInstanceKey();
  }

  let variables = $("#updatedVariables").val();

  sendSetVariablesRequest(getProcessInstanceKey(), scope, variables)
      .done(key => {
        const toastId = "set-variables-" + key;
        showNotificationSuccess(toastId, "Set variables <code>" + variables + "</code>.");

        loadVariablesOfProcessInstance();
      })
      .fail(showFailure(
          "set-variables" + scope,
          "Failed to set variables <code>" + variables + "</code>.")
      );
}

function cancelProcessInstance() {

  let processInstanceKey = getProcessInstanceKey();
  sendCancelProcessInstanceRequest(processInstanceKey)
      .done(key => {
        const toastId = "cancel-process-instance-" + processInstanceKey;
        showNotificationSuccess(toastId, "Cancelled process instance.");

        loadProcessInstanceView();
      })
      .fail(showFailure(
          "cancel-process-instance-" + processInstanceKey,
          "Failed to cancel process instance.")
      );
}

function loadElementInstancesOfProcessInstance() {

  const processInstanceKey = getProcessInstanceKey();

  queryElementInstancesByProcessInstance(processInstanceKey)
      .done(function (response) {

        let processInstance = response.data.processInstance;
        let elementInstances = processInstance.elementInstances;

        let totalCount = elementInstances.length;

        $("#element-instances-total-count").text(totalCount);

        $("#element-instances-of-process-instance-table tbody").empty();

        const indexOffset = 1;

        elementInstances.forEach((elementInstance, index) => {

          let locationButton = ' <button type="button" class="btn btn-sm btn-outline-light" title="Highlight element" onclick="highlightElement(\'' + elementInstance.elementId + '\');">'
              + '<svg class="bi" width="18" height="18"><use xlink:href="/img/bootstrap-icons.svg#geo-alt"/></svg>'
              + '</button>'

          let elementFormatted;
          if (elementInstance.elementName) {
            elementFormatted = locationButton + ' '
                + elementInstance.elementName;
          } else {
            elementFormatted = locationButton + ' ' + elementInstance.elementId;
          }

          let scopeFormatted = '';
          if (elementInstance.scope) {
            scopeFormatted = elementInstance.scope.key;
          }

          let endTime = '';
          if (elementInstance.endTime) {
            endTime = elementInstance.endTime;
          }

          let state = formatElementInstanceState(elementInstance.state);

          $("#element-instances-of-process-instance-table > tbody:last-child").append('<tr>'
              + '<td>' + (indexOffset + index) +'</td>'
              + '<td>' + elementFormatted +'</td>'
              + '<td>' + elementInstance.key + '</td>'
              + '<td>' + scopeFormatted +'</td>'
              + '<td>' + state +'</td>'
              + '<td>' + elementInstance.startTime +'</td>'
              + '<td>' + endTime +'</td>'
              + '</tr>');

        });

      });
}

function formatElementInstanceState(state) {
  switch (state) {
    case "ACTIVATING":
      return '<span class="badge bg-primary">activating</span>';
    case "ACTIVATED":
      return '<span class="badge bg-primary">activated</span>';
    case "COMPLETING":
      return '<span class="badge bg-secondary">completing</span>';
    case "COMPLETED":
      return '<span class="badge bg-secondary">completed</span>';
    case "TERMINATING":
      return '<span class="badge bg-dark">terminating</span>';
    case "TERMINATED":
      return '<span class="badge bg-dark">terminated</span>';
    case "TAKEN":
      return '<span class="badge bg-secondary">taken</span>';
    default:
      return "?"
  }
}
