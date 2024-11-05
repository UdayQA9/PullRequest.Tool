function getPullRequests() {
  const organization = document.getElementById("organization").value;
  const project = document.getElementById("project").value;
  const repository = document.getElementById("repository").value;
  const branch = document.getElementById("branch").value;
  const pat = document.getElementById("pat").value;

  //fetching from url
  fetch(
    `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullrequests?searchCriteria.status=Completed&searchCriteria.targetRefName=refs/heads/${branch}&$top=1000&api-version=7.0`,
    {
      headers: {
        Authorization: `Basic ${btoa(`:${pat}`)}`,
      },
    }
  )
    .then((response) => response.json())
    .then((data) => {
      const pullRequests = data.value;
      const pullRequestsTable = document.getElementById("pull-requests").getElementsByTagName("tbody")[0];

      // clearing table body
      pullRequestsTable.innerHTML = "";

      pullRequests.forEach((pullRequest, index) => {
        const row = pullRequestsTable.insertRow();
        const serialCell = row.insertCell();
        const titleCell = row.insertCell();
        const authorCell = row.insertCell();
        const createdCell = row.insertCell();
        const completedCell = row.insertCell();
        const statusCell = row.insertCell();
        const PRCell = row.insertCell();
        const commitCell = row.insertCell();

        serialCell.innerHTML = index + 1;
        titleCell.innerHTML = pullRequest.title;
        authorCell.innerHTML = pullRequest.createdBy.displayName;
        createdCell.innerHTML = new Date(pullRequest.creationDate).toLocaleDateString();
        completedCell.innerHTML = new Date(pullRequest.closedDate).toLocaleDateString(); // Added line to display completed date
        statusCell.innerHTML = pullRequest.status;
        PRCell.innerHTML = `<a href="https://dev.azure.com/${organization}/${project}/_git/${repository}/pullrequest/${pullRequest.pullRequestId}" target="_blank">${pullRequest.pullRequestId}</a>`;
        commitCell.innerHTML = pullRequest.lastMergeSourceCommit.commitId; // Added line to display commit ID
      });

      document.getElementById("tablediv").style.display = "block";
      
      // showing table after fetching pull requests
      document.getElementById("pull-requests").style.display = "block";
      
      //enabling export button after data fetching
      enableExportButton();
    })
    .catch((error) => console.log("something went wrong"));
}

function tabelToExcel() {
  var confirmDownload = confirm("Do you want to download the Pull Request data as an Excel file?");
  if (confirmDownload) {
    var table2excel = new Table2Excel();
    table2excel.export(document.querySelectorAll("table"));
  } else {
    alert("Downloading Data is Cancelled 🤨.");
  }
}

//Export button disabled script

function enableExportButton() {
  document.getElementById("exportButton2").removeAttribute("disabled");
}

//Table filter with Jquery plugin
$(document).ready(function () {
  $("#myInput").on("keyup", function () {
    var value = $(this).val().toLowerCase();
    $("#myTable tr").filter(function () {
      $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1)
    });
  });
});
